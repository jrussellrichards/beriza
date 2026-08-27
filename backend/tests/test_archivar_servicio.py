"""
Archivar un servicio, y borrarlo solo si no dejo rastro.

Observacion #1b del feedback del 25 de agosto de 2026: "No permite editar ni
eliminar servicios".

Borrar un servicio con acreditaciones destruiria el registro de que se le exigio
al contratista y que entrego, que es lo que hace defendible la acreditacion ante
una fiscalizacion. Entonces:

  - borrado REAL solo si el servicio no dejo rastro (error de tipeo),
  - ARCHIVADO para el resto: sale de la lista, conserva todo.

ARCHIVADO es una COLUMNA (archivado_en), no un cuarto EstadoServicio. Como estado
seria imposible archivar un contrato TERMINADO —que es el caso principal—,
pisaria el hecho de que termino, y sacaria el servicio de la evaluacion pudiendo
llevar al contratista de BLOQUEADA a ACREDITADA sin subir nada.

USA engine_sqlite() DE tests/_db.py, con PRAGMA foreign_keys=ON. Sin eso, un
borrado que deja expedientes huerfanos pasa EN VERDE: Expediente.servicio_id es
nullable, asi que SQLite sin FKs no dice nada y PostgreSQL tampoco fallaria —
simplemente quedarian apuntando a la nada.

Correr:  python tests/test_archivar_servicio.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_archivar_")

from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.exceptions import AsignacionInvalida, EstadoServicioInvalido, ServicioNoVacio
from app.domain import acreditacion_service, servicio_service
from app.domain.estados import EstadoAcreditacion, EstadoServicio
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.trabajador import Trabajador

from tests._db import engine_sqlite


def _armar(db):
    man = Mandante(razon_social="Minera Demo", rut="76.1-9", slug="m", plan="Pro")
    otro = Mandante(razon_social="Otra Minera", rut="76.9-1", slug="o", plan="Pro")
    emp = EmpresaContratista(razon_social="Contratista Demo", rut="77.2-8")
    db.add_all([man, otro, emp])
    db.flush()
    rel = ContratistaMandante(mandante_id=man.id, contratista_id=emp.id)
    db.add(rel)
    db.flush()
    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1)
    db.add(pilar)
    db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="EMP", nombre="Empresa", orden=1)
    db.add(sub)
    db.flush()
    req = RequisitoDocumental(
        subpilar_id=sub.id, codigo="F30", nombre="Certificado F30",
        entidad_tipo="EMPRESA", alcance="ENTIDAD",
    )
    db.add(req)
    db.commit()
    perfil = servicio_service.crear_perfil(db, man.id, "Obra civil")
    servicio_service.configurar_requisito_perfil(
        db, perfil.id, req.id, es_obligatorio=True, vigencia_max_dias=90,
    )
    return man, otro, emp, rel, perfil, req


def _crear(db, man, emp, perfil, nombre, **kw):
    return servicio_service.crear_servicio(
        db, man.id, emp.id, perfil.id, nombre, date.today(), **kw
    )


def run():
    eng = engine_sqlite()
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()

    with eng.connect() as c:
        assert c.execute(text("PRAGMA foreign_keys")).scalar() == 1, (
            "las claves foraneas estan apagadas: este test no probaria integridad")
    man, otro, emp, rel, perfil, req = _armar(db)

    # ── 1. Un servicio recien creado se puede borrar ─────────────────────────
    s1 = _crear(db, man, emp, perfil, "Faena creada por error")
    assert servicio_service.motivos_no_eliminable(db, s1.id) == []
    servicio_service.eliminar_servicio(db, s1.id, man.id)
    from app.models.servicio import Servicio, ServicioTrabajador
    assert db.get(Servicio, s1.id) is None, "no se borro"
    print("PASS: un servicio recien creado, sin nada colgando, se borra de verdad")

    # ── 2. Un trabajador DESASIGNADO sigue siendo rastro ─────────────────────
    # Este es el caso trampa: desasignar es soft (activo=False) y el listado de
    # la interfaz filtra activo=True, asi que el servicio SE VE vacio y no lo
    # esta. Un guard escrito sobre listar_trabajadores_servicio lo borraria.
    s2 = _crear(db, man, emp, perfil, "Faena con historial de gente")
    t = Trabajador(empresa_id=emp.id, rut="16.789.012-1", nombre_completo="Ana Ruiz")
    db.add(t)
    db.commit()
    servicio_service.asignar_trabajador(db, s2.id, t.id)
    servicio_service.desasignar_trabajador(db, s2.id, t.id)

    visibles = servicio_service.listar_trabajadores_servicio(db, s2.id)
    assert visibles == [], f"la interfaz aun muestra {len(visibles)} trabajador(es)"
    crudas = db.query(ServicioTrabajador).filter_by(servicio_id=s2.id).count()
    assert crudas == 1, (
        f"quedaron {crudas} filas crudas. Desasignar tiene que ser SOFT: esa fila "
        f"es el unico registro de que esa persona piso la faena.")

    try:
        servicio_service.eliminar_servicio(db, s2.id, man.id)
        raise AssertionError(
            "se borro un servicio que la interfaz muestra vacio pero que conserva "
            "el registro de que alguien estuvo asignado. El guard esta contando "
            "solo las asignaciones activas.")
    except ServicioNoVacio as e:
        assert "asignaci" in str(e), f"el mensaje no dice por que: {e}"
        assert "rchív" in str(e), f"el mensaje no ofrece la salida: {e}"
    print("PASS: un trabajador DESASIGNADO impide el borrado, aunque la interfaz lo muestre vacio")

    # ── 3. Un expediente borrado logicamente tambien es rastro ───────────────
    s3 = _crear(db, man, emp, perfil, "Faena con expediente")
    from datetime import datetime, timezone
    exp = Expediente(
        requisito_id=req.id, empresa_id=emp.id, servicio_id=s3.id,
        eliminado_en=datetime.now(timezone.utc),
    )
    db.add(exp)
    db.commit()
    try:
        servicio_service.eliminar_servicio(db, s3.id, man.id)
        raise AssertionError(
            "se borro un servicio con un expediente borrado logicamente. Ese "
            "expediente sigue existiendo y sigue colgando sus entregas y archivos; "
            "el DELETE lo dejaria apuntando a la nada, en silencio, porque "
            "Expediente.servicio_id es nullable y la base no se queja.")
    except ServicioNoVacio as e:
        assert "expediente" in str(e), f"el mensaje no dice por que: {e}"
    print("PASS: un expediente con eliminado_en tambien impide el borrado")

    # ── 4. Borrar no deja huerfanos ──────────────────────────────────────────
    s4 = _crear(db, man, emp, perfil, "Faena limpia")
    servicio_service.eliminar_servicio(db, s4.id, man.id)
    huerfanos = db.query(Expediente).filter_by(servicio_id=s4.id).count()
    huerfanas = db.query(ServicioTrabajador).filter_by(servicio_id=s4.id).count()
    assert huerfanos == 0 and huerfanas == 0, (huerfanos, huerfanas)
    print("PASS: un borrado permitido no deja filas huerfanas")

    # ── 5. La invariante: no se archiva lo que esta ACTIVO ───────────────────
    s5 = _crear(db, man, emp, perfil, "Faena activa")
    try:
        servicio_service.archivar_servicio(db, s5.id, man.id)
        raise AssertionError(
            "se archivo un servicio ACTIVO. Eso lo saca de la evaluacion y puede "
            "llevar al contratista de BLOQUEADA a ACREDITADA sin subir nada.")
    except EstadoServicioInvalido as e:
        assert "susp" in str(e).lower() or "termin" in str(e).lower(), e
    print("PASS: un servicio ACTIVO no se puede archivar; primero hay que cerrarlo")

    # ── 6. Terminar y despues archivar SI se puede ───────────────────────────
    # Con ARCHIVADO como estado esto seria imposible: TERMINADO es terminal.
    servicio_service.cambiar_estado_servicio(db, s5.id, EstadoServicio.TERMINADO)
    servicio_service.archivar_servicio(db, s5.id, man.id)
    db.refresh(s5)
    assert s5.archivado_en is not None, "no quedo archivado"
    assert s5.estado == EstadoServicio.TERMINADO, (
        f"archivar piso el estado y lo dejo en {s5.estado}. El estado es un hecho "
        f"del contrato; archivar es solo esconderlo de la lista.")
    print("PASS: un TERMINADO se archiva, y conserva que estaba TERMINADO")

    # ── 7. Archivar NO mueve el estado de acreditacion ───────────────────────
    # El test mas importante: es la razon de la invariante.
    s6 = _crear(db, man, emp, perfil, "Faena que se va a archivar")
    acreditacion_service.recalcular_estado_global(db, emp.id, man.id)
    db.refresh(rel)
    antes = rel.estado_acreditacion
    assert antes == EstadoAcreditacion.BLOQUEADA, (
        f"el escenario no es el esperado: {antes}. Se necesita una brecha abierta.")

    servicio_service.cambiar_estado_servicio(db, s6.id, EstadoServicio.SUSPENDIDO)
    db.refresh(rel)
    intermedio = rel.estado_acreditacion
    servicio_service.archivar_servicio(db, s6.id, man.id)
    db.refresh(rel)
    assert rel.estado_acreditacion == intermedio, (
        f"archivar cambio la acreditacion de {intermedio} a {rel.estado_acreditacion} "
        f"sin que nadie subiera un documento. La invariante existe justamente para "
        f"que archivar no pueda mover un numero derivado.")
    print(f"PASS: archivar no movio la acreditacion (siguio en {intermedio})")

    # ── 8. El archivado sale de los listados ─────────────────────────────────
    listados = servicio_service.listar_servicios(db, mandante_id=man.id)
    ids = {s.id for s in listados}
    assert s5.id not in ids and s6.id not in ids, "un archivado sigue apareciendo"
    con_archivados = servicio_service.listar_servicios(
        db, mandante_id=man.id, incluir_archivados=True
    )
    assert s5.id in {s.id for s in con_archivados}, "incluir_archivados=True no los trae"
    print(f"PASS: los archivados no salen del listado ({len(listados)} visibles, "
          f"{len(con_archivados)} con archivados)")

    # ── 9. Un archivado no cambia de estado ──────────────────────────────────
    try:
        servicio_service.cambiar_estado_servicio(db, s6.id, EstadoServicio.ACTIVO)
        raise AssertionError(
            "se reactivo un servicio archivado. Volveria a la evaluacion sin que "
            "nadie lo vea en ninguna lista.")
    except EstadoServicioInvalido as e:
        assert "rchiv" in str(e).lower().replace("í", "i"), e
    print("PASS: un archivado no puede cambiar de estado sin desarchivarse")

    # ── 10. Desarchivar restituye sin inventar estado ────────────────────────
    servicio_service.desarchivar_servicio(db, s6.id, man.id)
    db.refresh(s6)
    assert s6.archivado_en is None
    assert s6.estado == EstadoServicio.SUSPENDIDO, (
        f"desarchivar dejo el estado en {s6.estado}. Como el estado nunca se pisó, "
        f"no hay nada que adivinar al volver.")
    assert s6.id in {s.id for s in servicio_service.listar_servicios(db, mandante_id=man.id)}
    print("PASS: desarchivar devuelve a la lista y conserva el estado original")

    # ── 11. Aislamiento entre mandantes ──────────────────────────────────────
    s7 = _crear(db, man, emp, perfil, "Faena ajena")
    for fn in (servicio_service.eliminar_servicio, servicio_service.desarchivar_servicio):
        try:
            fn(db, s7.id, otro.id)
            raise AssertionError(f"{fn.__name__} dejo actuar sobre un servicio de OTRO mandante")
        except AsignacionInvalida:
            pass
    print("PASS: no se puede borrar ni desarchivar un servicio de otro mandante")

    db.close()
    print("TODOS LOS TESTS DE ARCHIVAR/ELIMINAR SERVICIO PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_archivar_servicio():
    run()
