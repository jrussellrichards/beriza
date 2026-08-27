"""
Smoke test del portal del contratista v2, contra SQLite.

Lo que importa verificar: que la habilitacion sea POR SERVICIO y no por
mandante. Dos servicios del MISMO cliente pueden referenciar perfiles distintos,
asi que un trabajador puede estar habilitado en uno y bloqueado en el otro. Ese
caso era invisible en el portal anterior.

Correr:  python tests/test_portal_contratista.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_portal_")

from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, Entrega, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.centro_trabajo import CentroTrabajo
from app.models.servicio import (
    PerfilRequisitos, PerfilRequisitoConfig, Servicio, ServicioTrabajador,
)
from app.models.trabajador import Trabajador
from app.models.usuario import Usuario
from app.domain import acreditacion_service
from app.domain.estados import (
    EstadoAcreditacion, EstadoDocumento, EstadoServicio,
)

from tests._db import engine_sqlite

HOY = date.today()


def run():
    eng = engine_sqlite()
    Base.metadata.create_all(eng)
    db = Session(eng)

    c = EmpresaContratista(rut="76.5-5", razon_social="ABC")
    codelco = Mandante(razon_social="Codelco", rut="1-9", slug="codelco", plan="Pro")
    db.add_all([c, codelco]); db.flush()
    u = Usuario(email="ct@abc.cl", password_hash="x", rol="contratista_admin",
                nombre="CT", contratista_id=c.id, activo=True)
    db.add(u); db.flush()
    rel = ContratistaMandante(contratista_id=c.id, mandante_id=codelco.id,
                              estado_acreditacion=EstadoAcreditacion.PENDIENTE)
    db.add(rel); db.flush()

    pilar = Pilar(codigo="HSE", nombre="HSE", orden=0); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="TRAB", nombre="Trabajador", orden=0)
    db.add(sub); db.flush()

    contrato = RequisitoDocumental(subpilar_id=sub.id, codigo="CONTRATO", nombre="Contrato",
                                   entidad_tipo="TRABAJADOR", alcance="ENTIDAD")
    altura = RequisitoDocumental(subpilar_id=sub.id, codigo="ALTURA", nombre="Examen de altura",
                                 entidad_tipo="TRABAJADOR", alcance="ENTIDAD")
    db.add_all([contrato, altura]); db.flush()

    # DOS servicios del MISMO mandante con perfiles distintos: Obra Norte exige
    # el examen de altura, Obra Sur no.
    p_norte = PerfilRequisitos(mandante_id=codelco.id, nombre="Norte"); db.add(p_norte); db.flush()
    p_sur = PerfilRequisitos(mandante_id=codelco.id, nombre="Sur"); db.add(p_sur); db.flush()
    for req in (contrato, altura):
        db.add(PerfilRequisitoConfig(perfil_id=p_norte.id, requisito_documental_id=req.id,
                                     es_obligatorio=True, vigencia_max_dias=365))
    db.add(PerfilRequisitoConfig(perfil_id=p_sur.id, requisito_documental_id=contrato.id,
                                 es_obligatorio=True, vigencia_max_dias=365))

    # Solo Obra Norte tiene centro: asi se cubren las dos ramas, la que muestra
    # el lugar y la que no tiene ninguno que mostrar.
    chuqui = CentroTrabajo(mandante_id=codelco.id, nombre="Chuquicamata",
                           direccion="Calama")
    db.add(chuqui); db.flush()

    norte = Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=p_norte.id,
                     nombre="Obra Norte", fecha_inicio=HOY,
                     centro_trabajo_id=chuqui.id,
                     estado=EstadoServicio.ACTIVO)
    sur = Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=p_sur.id,
                   nombre="Obra Sur", fecha_inicio=HOY,
                   estado=EstadoServicio.ACTIVO)
    db.add_all([norte, sur]); db.flush()

    pedro = Trabajador(empresa_id=c.id, rut="11.1-1", nombre_completo="Pedro González",
                       cargo="Jefe de obra", activo=True)
    db.add(pedro); db.flush()
    for s in (norte, sur):
        db.add(ServicioTrabajador(servicio_id=s.id, trabajador_id=pedro.id,
                                  activo=True, fecha_asignacion=HOY))

    # Pedro tiene el contrato aprobado, pero NO el examen de altura.
    exp = Expediente(requisito_id=contrato.id, trabajador_id=pedro.id); db.add(exp); db.flush()
    e = Entrega(expediente_id=exp.id, numero_version=1); db.add(e); db.flush()
    db.add(Acreditacion(mandante_id=codelco.id, expediente_id=exp.id, entrega_id=e.id,
                        numero_version=1, estado=EstadoDocumento.APROBADO))
    db.commit()

    # 1. La habilitacion difiere entre dos servicios del MISMO mandante.
    trabs = acreditacion_service.habilitacion_trabajadores(db, c.id)
    p = next(t for t in trabs if t.trabajador_id == pedro.id)
    por_servicio = {s.servicio_nombre: s for s in p.servicios}
    assert por_servicio["Obra Sur"].habilitado is True, "Obra Sur no exige altura: debe estar habilitado"
    assert por_servicio["Obra Norte"].habilitado is False, "Obra Norte exige altura: debe estar bloqueado"
    assert "Examen de altura" in por_servicio["Obra Norte"].faltantes
    print("PASS: habilitado en un servicio y bloqueado en OTRO del mismo mandante")

    # 2. El centro llega al portal. Ocupa el lugar de "obra/faena/servicio", que
    # se pregunto para decir DONDE se ejecutaba y se elimino: dos servicios del
    # mismo cliente pueden llamarse igual, y sin el centro el contratista no
    # sabe a que faena mandar a su gente.
    assert por_servicio["Obra Norte"].centro_trabajo_nombre == "Chuquicamata"
    assert por_servicio["Obra Sur"].centro_trabajo_nombre is None,         "un servicio sin centro debe viajar en null, no inventarse uno"
    print("PASS: el centro de trabajo del servicio llega al portal")

    # 3. Bandeja unificada: el trabajador incompleto aparece como pendiente.
    pend = acreditacion_service.pendientes_del_contratista(db, c.id)
    incompletos = [x for x in pend if x.tipo == "TRABAJADOR_INCOMPLETO"]
    assert any("Pedro" in x.titulo and "Obra Norte" in x.titulo for x in incompletos), \
        f"debio aparecer Pedro sin habilitar en Obra Norte: {[x.titulo for x in incompletos]}"
    assert all("No podrá ingresar" in (x.detalle or "") for x in incompletos), (
        "el pendiente debe enunciar la CONSECUENCIA, no el estado tecnico")
    # El nombre del servicio se repite entre clientes: sin el mandante dos
    # pendientes distintos se verian identicos en la bandeja.
    assert all("Codelco" in x.titulo for x in incompletos), "el titulo debe identificar al cliente"
    assert len(incompletos) == 1, f"debio ser 1 pendiente agrupado, fueron {len(incompletos)}"
    print("PASS: la bandeja lista al trabajador que no podra ingresar")

    # 4. Y NO aparece por Obra Sur, donde si cumple.
    assert not any("Obra Sur" in x.titulo for x in incompletos), \
        "no debe reportarse un pendiente donde el trabajador si cumple"
    print("PASS: no se reporta pendiente donde el trabajador si cumple")

    # 5. Ordenada por urgencia.
    assert pend == sorted(pend, key=lambda x: (x.urgencia, x.titulo)), "debe venir por urgencia"
    print("PASS: la bandeja viene ordenada por urgencia")

    # ── Riesgo del mandante ─────────────────────────────────────────────────
    # La unidad es la FAENA, no el contratista: la misma empresa esta impecable
    # en Obra Sur y tiene gente sin habilitar en Obra Norte. Agrupar por
    # contratista escondería justo el lugar donde hay riesgo.
    riesgo = acreditacion_service.riesgo_del_mandante(db, codelco.id)
    por_nombre = {s.servicio_nombre: s for s in riesgo.servicios}

    assert riesgo.total_servicios == 2
    assert riesgo.servicios_en_riesgo == 1, "solo Obra Norte tiene gente sin habilitar"
    assert por_nombre["Obra Norte"].trabajadores_no_habilitados == 1
    assert por_nombre["Obra Sur"].trabajadores_no_habilitados == 0
    print("PASS: el riesgo del mandante se reporta por faena, no por contratista")

    assert riesgo.servicios[0].servicio_nombre == "Obra Norte",         "lo mas expuesto debe venir primero"
    assert riesgo.personas_no_habilitadas == 1
    print("PASS: las faenas mas expuestas vienen primero")

    print("TODOS LOS TESTS DEL PORTAL PASARON")


if __name__ == "__main__":
    run()

# ── Puente para pytest ────────────────────────────────────────────────────────
# Estos archivos nacieron como scripts (`python tests/test_x.py`) y su punto de
# entrada se llama run(), que pytest NO recolecta porque no empieza con "test_".
# Resultado: la suite reportaba verde corriendo 5 de los ~30 tests que existen.
# El envoltorio los expone sin tocar la lógica, y el modo script sigue andando.
def test_portal_contratista():
    run()
