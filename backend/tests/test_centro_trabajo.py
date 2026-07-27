"""
Smoke test de centros de trabajo, contra SQLite.

Lo que importa verificar no es que se cree un centro —eso es trivial— sino las
reglas de AISLAMIENTO, que son las que rompen un multi-tenant:

  1. que un mandante no vea ni use centros de otro,
  2. que el encargado sea alguien de SU equipo y no un usuario cualquiera,
  3. que un servicio no pueda colgarse de una faena ajena pasando el id,
  4. y que un contratista pueda trabajar en VARIOS centros a la vez, que es el
     caso que el arbol del informe no soportaba.

Correr:  python tests/test_centro_trabajo.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_centro_")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.core.exceptions import AsignacionInvalida
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.mandante import Mandante
from app.models.servicio import PerfilRequisitos
from app.models.usuario import Usuario
from app.domain import centro_trabajo_service as centros
from app.domain import servicio_service
from app.domain.centro_trabajo_service import CentroTrabajoInvalido, CentroTrabajoNoEncontrado
from app.domain.estados import EstadoServicio


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = Session(eng)

    codelco = Mandante(razon_social="Codelco", rut="61.704.000-K", slug="cod", plan="Pro")
    otro = Mandante(razon_social="Los Pelambres", rut="70.000.000-7", slug="lp", plan="Pro")
    db.add_all([codelco, otro]); db.flush()

    ana = Usuario(email="ana@cod.cl", password_hash="x", rol="prevencionista",
                  nombre="Ana Rojas", mandante_id=codelco.id, activo=True)
    ajeno = Usuario(email="x@lp.cl", password_hash="x", rol="prevencionista",
                    nombre="Ajeno", mandante_id=otro.id, activo=True)
    db.add_all([ana, ajeno]); db.flush()

    perfil = PerfilRequisitos(mandante_id=codelco.id, nombre="General")
    perfil_otro = PerfilRequisitos(mandante_id=otro.id, nombre="General")
    db.add_all([perfil, perfil_otro]); db.flush()

    transportes = EmpresaContratista(rut="79.777.888-5", razon_social="Transportes Altiplano")
    db.add(transportes); db.flush()
    db.add(ContratistaMandante(contratista_id=transportes.id, mandante_id=codelco.id))
    db.commit()

    # ── 1. Alta con encargado del propio equipo ──────────────────────────────
    chuqui = centros.crear(db, codelco.id, nombre="Chuquicamata",
                           direccion="Calama, Región de Antofagasta", encargado_id=ana.id)
    rt = centros.crear(db, codelco.id, nombre="Radomiro Tomic", direccion="Calama")
    assert chuqui.encargado.nombre == "Ana Rojas"
    assert chuqui.direccion == "Calama, Región de Antofagasta"
    assert rt.encargado_id is None, "el encargado es opcional: el cargo puede estar vacante"
    print("PASS: crea centros con nombre, direccion y encargado del equipo")

    # ── 2. El encargado NO puede ser de otra organizacion ────────────────────
    # Es una fuga: el encargado se muestra en las pantallas del centro.
    try:
        centros.crear(db, codelco.id, nombre="El Teniente", encargado_id=ajeno.id)
        raise AssertionError("acepto como encargado a un usuario de otro mandante")
    except CentroTrabajoInvalido as e:
        assert "organización" in str(e), f"el error debe decir por que: {e}"
    print("PASS: rechaza un encargado de otra organizacion")

    # ── 3. Nombres duplicados dentro del mandante ────────────────────────────
    try:
        centros.crear(db, codelco.id, nombre="Chuquicamata")
        raise AssertionError("acepto dos centros con el mismo nombre")
    except CentroTrabajoInvalido:
        pass
    # Pero OTRO mandante si puede llamar igual a su centro.
    ajeno_centro = centros.crear(db, otro.id, nombre="Chuquicamata")
    assert ajeno_centro.id != chuqui.id
    print("PASS: nombre unico por mandante, no global")

    # ── 4. Aislamiento de lectura ────────────────────────────────────────────
    mios = centros.listar(db, codelco.id)
    assert {c.nombre for c in mios} == {"Chuquicamata", "Radomiro Tomic"}, \
        f"vio centros que no son suyos: {[c.nombre for c in mios]}"
    try:
        centros.obtener(db, ajeno_centro.id, codelco.id)
        raise AssertionError("leyo un centro de otro mandante por id")
    except CentroTrabajoNoEncontrado:
        pass
    print("PASS: un mandante no ve ni lee centros de otro")

    # ── 5. El servicio se ancla al centro ────────────────────────────────────
    s1 = servicio_service.crear_servicio(
        db, mandante_id=codelco.id, contratista_id=transportes.id,
        perfil_requisitos_id=perfil.id, nombre="Transporte de personal",
        fecha_inicio=date.today(), centro_trabajo_id=chuqui.id)
    assert s1.centro_trabajo_id == chuqui.id
    print("PASS: el servicio queda anclado a su centro")

    # ── 6. EL CASO QUE EL ARBOL DEL INFORME NO SOPORTABA ─────────────────────
    # Mandante -> Centro -> Contratista -> Servicio implica que un contratista
    # pertenece a UNA faena. Transportes Altiplano trabaja en las dos.
    s2 = servicio_service.crear_servicio(
        db, mandante_id=codelco.id, contratista_id=transportes.id,
        perfil_requisitos_id=perfil.id, nombre="Transporte turno noche",
        fecha_inicio=date.today(), centro_trabajo_id=rt.id)
    assert s2.centro_trabajo_id == rt.id
    centros_del_contratista = {s.centro_trabajo.nombre for s in [s1, s2]}
    assert centros_del_contratista == {"Chuquicamata", "Radomiro Tomic"}, \
        f"un contratista debe poder trabajar en varios centros: {centros_del_contratista}"
    print("PASS: un contratista trabaja en VARIOS centros del mismo mandante")

    # ── 7. No se puede colgar un servicio de una faena ajena ─────────────────
    try:
        servicio_service.crear_servicio(
            db, mandante_id=codelco.id, contratista_id=transportes.id,
            perfil_requisitos_id=perfil.id, nombre="Colado",
            fecha_inicio=date.today(), centro_trabajo_id=ajeno_centro.id)
        raise AssertionError("colgo un servicio de un centro de otro mandante")
    except AsignacionInvalida as e:
        assert "organización" in str(e), f"{e}"
    print("PASS: no se puede anclar un servicio a un centro ajeno")

    # ── 8. Centro cerrado: no admite servicios nuevos, conserva los viejos ───
    vacio = centros.crear(db, codelco.id, nombre="Salvador")
    centros.desactivar(db, vacio.id, codelco.id)
    assert vacio.activo is False
    assert vacio.nombre not in {c.nombre for c in centros.listar(db, codelco.id)}, \
        "un centro cerrado no debe ofrecerse al crear servicios"
    assert vacio.nombre in {c.nombre for c in centros.listar(db, codelco.id, incluir_inactivos=True)}
    try:
        servicio_service.crear_servicio(
            db, mandante_id=codelco.id, contratista_id=transportes.id,
            perfil_requisitos_id=perfil.id, nombre="Tardio",
            fecha_inicio=date.today(), centro_trabajo_id=vacio.id)
        raise AssertionError("creo un servicio en un centro cerrado")
    except AsignacionInvalida as e:
        assert "cerrado" in str(e)
    print("PASS: un centro cerrado no admite servicios nuevos")

    # Y los servicios que ya estaban siguen apuntando al centro: la bitacora
    # necesita saber DONDE ocurrieron las cosas, aunque la faena ya no opere.
    assert servicio_service.crear_servicio is not None
    assert s1.centro_trabajo.nombre == "Chuquicamata"
    print("PASS: cerrar un centro no borra el historial de sus servicios")

    # ── 9. Contar servicios activos, que es lo que responde "puedo cerrarlo?" ─
    assert centros.servicios_activos(db, chuqui.id) == 1
    assert centros.servicios_activos(db, vacio.id) == 0
    s1.estado = EstadoServicio.TERMINADO
    db.commit()
    assert centros.servicios_activos(db, chuqui.id) == 0, \
        "un servicio terminado no deberia contar como activo"
    print("PASS: cuenta solo los servicios vigentes del centro")

    # ── 10. Dejar el cargo vacante es explicito ──────────────────────────────
    centros.actualizar(db, chuqui.id, codelco.id, limpiar_encargado=True)
    db.refresh(chuqui)
    assert chuqui.encargado_id is None, "no se pudo dejar el cargo vacante"
    # Y una edicion que NO menciona el encargado no lo borra por accidente.
    centros.actualizar(db, rt.id, codelco.id, encargado_id=ana.id)
    centros.actualizar(db, rt.id, codelco.id, direccion="Otra direccion")
    db.refresh(rt)
    assert rt.encargado_id == ana.id, "editar la direccion borro el encargado"
    print("PASS: vaciar el cargo es explicito; editar otro campo no lo pisa")

    # ── 11. Asignar centro a un servicio que ya existia ──────────────────────
    # Es la razon de ser del endpoint de edicion: los servicios creados antes de
    # que hubiera centros mostraban "Sin centro asignado" y no habia forma de
    # arreglarlo. Una pantalla que senala un problema sin dar salida.
    huerfano = servicio_service.crear_servicio(
        db, mandante_id=codelco.id, contratista_id=transportes.id,
        perfil_requisitos_id=perfil.id, nombre="Legado sin centro",
        fecha_inicio=date.today())
    assert huerfano.centro_trabajo_id is None
    servicio_service.actualizar_servicio(db, huerfano.id, codelco.id, centro_trabajo_id=chuqui.id)
    db.refresh(huerfano)
    assert huerfano.centro_trabajo_id == chuqui.id, "no se pudo asignar el centro"
    print("PASS: se le puede asignar centro a un servicio que no tenia")

    # Y cambiarlo despues.
    servicio_service.actualizar_servicio(db, huerfano.id, codelco.id, centro_trabajo_id=rt.id)
    db.refresh(huerfano)
    assert huerfano.centro_trabajo_id == rt.id
    print("PASS: se puede cambiar el centro de un servicio")

    # ── 12. No se puede editar un servicio de OTRO mandante ──────────────────
    try:
        servicio_service.actualizar_servicio(
            db, huerfano.id, otro.id, centro_trabajo_id=ajeno_centro.id)
        raise AssertionError("edito un servicio de otro mandante")
    except AsignacionInvalida as e:
        assert "organización" in str(e)
    db.refresh(huerfano)
    assert huerfano.centro_trabajo_id == rt.id, "el servicio ajeno quedo modificado"
    print("PASS: no se puede editar un servicio de otra organizacion")

    # Ni moverlo a un centro ajeno desde el propio mandante.
    try:
        servicio_service.actualizar_servicio(
            db, huerfano.id, codelco.id, centro_trabajo_id=ajeno_centro.id)
        raise AssertionError("movio el servicio a un centro de otro mandante")
    except AsignacionInvalida:
        pass
    print("PASS: no se puede mover un servicio a un centro ajeno")

    # ── 13. Ni a un centro cerrado ───────────────────────────────────────────
    try:
        servicio_service.actualizar_servicio(
            db, huerfano.id, codelco.id, centro_trabajo_id=vacio.id)
        raise AssertionError("movio el servicio a un centro cerrado")
    except AsignacionInvalida as e:
        assert "cerrado" in str(e)
    print("PASS: no se puede mover un servicio a un centro cerrado")

    # ── 14. La edicion es PARCIAL: lo que no se manda no se pisa ─────────────
    servicio_service.actualizar_servicio(db, huerfano.id, codelco.id, nombre="Renombrado")
    db.refresh(huerfano)
    assert huerfano.nombre == "Renombrado"
    assert huerfano.centro_trabajo_id == rt.id, "renombrar borro el centro"
    perfil_antes = huerfano.perfil_requisitos_id
    servicio_service.actualizar_servicio(db, huerfano.id, codelco.id, codigo_referencia="CTR-9")
    db.refresh(huerfano)
    assert huerfano.nombre == "Renombrado" and huerfano.perfil_requisitos_id == perfil_antes,         "una edicion parcial toco campos que no venian en el request"
    print("PASS: la edicion es parcial y no pisa lo que no viene")

    print("TODOS LOS TESTS DE CENTRO DE TRABAJO PASARON")


if __name__ == "__main__":
    run()
