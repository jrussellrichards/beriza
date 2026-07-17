"""
Seed completo de la plataforma Acredita.
Crea: pilares/requisitos, 4 mandantes con usuarios, 7 contratistas Codelco con
trabajadores y documentos en distintos estados, más contratistas bulk para los
demás mandantes.

Uso:
    cd backend
    python scripts/seed.py
"""

import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import uuid as uuid_lib

from app.core.config import settings
from app.domain.estados import Alcance, EstadoServicio, TipoEvento
from app.models import Base, Usuario
from app.models.mandante import Mandante
from app.models.contratista import EmpresaContratista, ContratistaMandante
from app.models.pilar import Pilar, Subpilar, RequisitoDocumental
from app.models.servicio import PerfilRequisitos, PerfilRequisitoConfig, Servicio, ServicioTrabajador
from app.models.trabajador import Trabajador
from app.models.documento import ArchivoDocumento, Documento, DocumentoEvento, DocumentoVersion

engine = create_engine(settings.DATABASE_URL)

HOY = date.today()

# ── Parametrización del catálogo (decisiones de negocio explícitas) ──────────

# Vigencia máxima en días exigida por defecto para cada requisito
VIGENCIAS = {
    "F30": 30, "F30_1": 30, "CONTRATO": 365, "EXAM_MED": 365,
    "MIPER": 365, "RIOHS": 365, "DAS": 365,
    "CARPETA_TRIBUTARIA": 90, "VIGENCIA_SOCIEDAD": 365, "DJ_CONFLICTO": 365,
}
VIGENCIA_DEFAULT = 90

# Alcance: ENTIDAD se acredita una vez para el mandante; SERVICIO por cada faena.
# La MIPER es específica de los riesgos de cada faena → SERVICIO.
ALCANCES = {
    "MIPER": Alcance.SERVICIO,
}

# Cantidad máxima de archivos por entrega (contrato + anexos, carpeta multi-PDF)
MAX_ARCHIVOS = {
    "CONTRATO": 3,
    "CARPETA_TRIBUTARIA": 5,
}


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _vigencia(dias: int) -> date:
    return HOY + timedelta(days=dias)


# ── Pilares y requisitos ──────────────────────────────────────────────────────

def _aplicar_parametros_catalogo(reqs: dict[str, RequisitoDocumental]):
    """Aplica alcance y max_archivos según las decisiones de negocio del módulo."""
    for codigo, req in reqs.items():
        req.alcance = ALCANCES.get(codigo, Alcance.ENTIDAD)
        req.max_archivos = MAX_ARCHIVOS.get(codigo, 1)


def seed_pilares(session: Session) -> dict[str, RequisitoDocumental]:
    if session.query(Pilar).count() > 0:
        print("  OK Pilares ya existen, actualizando alcances del catálogo.")
        reqs = {r.codigo: r for r in session.query(RequisitoDocumental).all()}
        _aplicar_parametros_catalogo(reqs)
        return reqs

    legal = Pilar(codigo="LEGAL", nombre="Legal / Laboral", orden=1)
    session.add(legal); session.flush()

    legal_sub = Subpilar(pilar_id=legal.id, codigo="LEGAL_EMPRESA", nombre="Documentos empresa", orden=1)
    session.add(legal_sub); session.flush()

    f30 = RequisitoDocumental(subpilar_id=legal_sub.id, codigo="F30",
        nombre="Certificado F30 — Antecedentes laborales y previsionales", entidad_tipo="EMPRESA")
    f30_1 = RequisitoDocumental(subpilar_id=legal_sub.id, codigo="F30_1",
        nombre="Certificado F30-1 — Deuda previsional trabajadores", entidad_tipo="EMPRESA")
    contrato = RequisitoDocumental(subpilar_id=legal_sub.id, codigo="CONTRATO",
        nombre="Contrato de trabajo", entidad_tipo="TRABAJADOR")
    session.add_all([f30, f30_1, contrato])

    hse = Pilar(codigo="HSE", nombre="HSE — Salud, Seguridad y Medio Ambiente", orden=2)
    session.add(hse); session.flush()

    hse_sub = Subpilar(pilar_id=hse.id, codigo="HSE_TRABAJADOR", nombre="Documentos trabajador", orden=1)
    session.add(hse_sub); session.flush()

    exam_med = RequisitoDocumental(subpilar_id=hse_sub.id, codigo="EXAM_MED",
        nombre="Examen médico ocupacional", entidad_tipo="TRABAJADOR")
    miper = RequisitoDocumental(subpilar_id=hse_sub.id, codigo="MIPER",
        nombre="Matriz de Identificación de Peligros y Evaluación de Riesgos (MIPER)", entidad_tipo="EMPRESA")
    riohs = RequisitoDocumental(subpilar_id=hse_sub.id, codigo="RIOHS",
        nombre="Reglamento Interno de Orden, Higiene y Seguridad (RIOHS)", entidad_tipo="EMPRESA")
    das = RequisitoDocumental(subpilar_id=hse_sub.id, codigo="DAS",
        nombre="Declaración de Accidentabilidad y Siniestralidad (DAS)", entidad_tipo="EMPRESA")
    session.add_all([exam_med, miper, riohs, das])

    compliance = Pilar(codigo="COMPLIANCE", nombre="Compliance / Tributario", orden=3)
    session.add(compliance); session.flush()

    comp_sub = Subpilar(pilar_id=compliance.id, codigo="COMPLIANCE_EMPRESA", nombre="Documentos empresa", orden=1)
    session.add(comp_sub); session.flush()

    carpeta = RequisitoDocumental(subpilar_id=comp_sub.id, codigo="CARPETA_TRIBUTARIA",
        nombre="Carpeta tributaria electrónica", entidad_tipo="EMPRESA")
    vigencia_soc = RequisitoDocumental(subpilar_id=comp_sub.id, codigo="VIGENCIA_SOCIEDAD",
        nombre="Certificado de vigencia de la sociedad", entidad_tipo="EMPRESA")
    dj = RequisitoDocumental(subpilar_id=comp_sub.id, codigo="DJ_CONFLICTO",
        nombre="Declaración jurada de conflicto de interés", entidad_tipo="EMPRESA")
    session.add_all([carpeta, vigencia_soc, dj])
    session.flush()

    reqs = {r.codigo: r for r in [f30, f30_1, contrato, exam_med, miper, riohs, das, carpeta, vigencia_soc, dj]}
    _aplicar_parametros_catalogo(reqs)
    print("  OK 3 pilares y 10 requisitos creados.")
    return reqs


# ── Admin BERISA ──────────────────────────────────────────────────────────────

def seed_admin(session: Session):
    if session.query(Usuario).filter_by(email="admin@berisa.cl").first():
        print("  OK Admin ya existe, saltando.")
        return
    session.add(Usuario(
        email="admin@berisa.cl", nombre="Admin BERISA",
        password_hash=_hash("admin123"), rol="berisa_admin", activo=True,
    ))
    print("  OK admin@berisa.cl / admin123")


# ── Mandantes ─────────────────────────────────────────────────────────────────

def _crear_mandante(session: Session, razon_social, rut, slug, plan, email_contacto,
                    sitio_web, activo, email_usuario, nombre_usuario) -> Mandante:
    m = Mandante(
        razon_social=razon_social, rut=rut, slug=slug,
        plan=plan, email_contacto=email_contacto, sitio_web=sitio_web, activo=activo,
    )
    session.add(m); session.flush()
    session.add(Usuario(
        email=email_usuario, nombre=nombre_usuario,
        password_hash=_hash("demo123"), rol="mandante_admin", activo=True, mandante_id=m.id,
    ))
    return m


def _get_or_create_mandante(session: Session, slugs: dict, razon_social, rut, slug, plan,
                             email_usuario, sitio_web, activo, email_contacto, nombre_admin):
    if slug in slugs:
        return slugs[slug]
    return _crear_mandante(session, razon_social, rut, slug, plan,
                           email_usuario, sitio_web, activo, email_contacto, nombre_admin)


def seed_mandantes(session: Session) -> dict[str, Mandante]:
    slugs = {m.slug: m for m in session.query(Mandante).all()}

    codelco = _get_or_create_mandante(session, slugs,
        "Codelco (Demo)", "61.704.000-K", "codelco-demo", "Enterprise",
        "mandante@demo.cl", "https://www.codelco.com", True,
        "mandante@demo.cl", "Carlos Mendoza",
    )
    if "codelco-demo" not in slugs:
        session.add(Usuario(
            email="prevencion@codelco.cl", nombre="Patricia Rojas",
            password_hash=_hash("demo123"), rol="prevencionista", activo=True, mandante_id=codelco.id,
        ))

    pelambres = _get_or_create_mandante(session, slugs,
        "Minera Los Pelambres", "96.525.120-9", "los-pelambres", "Enterprise",
        "mandante2@demo.cl", "https://www.lospelambres.cl", True,
        "mandante2@demo.cl", "Valentina Soto",
    )
    echeverria = _get_or_create_mandante(session, slugs,
        "Constructora Echeverría Izquierdo", "85.426.200-3", "echeverria-izquierdo", "Pro",
        "mandante3@demo.cl", "https://www.ei.cl", True,
        "mandante3@demo.cl", "Rodrigo Herrera",
    )
    enap = _get_or_create_mandante(session, slugs,
        "ENAP Refinerías", "99.590.200-6", "enap-refinerias", "Pro",
        "mandante4@demo.cl", "https://www.enap.cl", False,
        "mandante4@demo.cl", "Ignacio Fuentes",
    )

    nuevos = sum(1 for s in ["codelco-demo", "los-pelambres", "echeverria-izquierdo", "enap-refinerias"] if s not in slugs)
    if nuevos:
        print(f"  OK {nuevos} mandante(s) creado(s).")
    else:
        print("  OK Mandantes ya existen, saltando.")

    return {"codelco-demo": codelco, "los-pelambres": pelambres,
            "echeverria-izquierdo": echeverria, "enap-refinerias": enap}


# ── Perfiles y servicios ──────────────────────────────────────────────────────

def seed_perfiles_y_servicios(session: Session, reqs: dict[str, RequisitoDocumental]):
    """
    Idempotente. Para cada mandante asegura un perfil "General" con la config
    de todos los requisitos; para cada relación contratista↔mandante un servicio
    "General" activo; y todos los trabajadores de la empresa asignados a él.
    """
    perfiles_creados = servicios_creados = asignaciones_creadas = 0

    for mandante in session.query(Mandante).all():
        perfil = session.query(PerfilRequisitos).filter_by(
            mandante_id=mandante.id, nombre="General"
        ).first()
        if not perfil:
            perfil = PerfilRequisitos(
                mandante_id=mandante.id, nombre="General",
                descripcion="Perfil por defecto con todos los requisitos del catálogo", activo=True,
            )
            session.add(perfil); session.flush()
            perfiles_creados += 1

        configs_existentes = {
            str(c.requisito_documental_id)
            for c in session.query(PerfilRequisitoConfig).filter_by(perfil_id=perfil.id).all()
        }
        for codigo, req in reqs.items():
            if str(req.id) not in configs_existentes:
                session.add(PerfilRequisitoConfig(
                    perfil_id=perfil.id, requisito_documental_id=req.id,
                    es_obligatorio=True, vigencia_max_dias=VIGENCIAS.get(codigo, VIGENCIA_DEFAULT),
                    umbral_deuda_max=0,
                ))
        session.flush()

        for rel in session.query(ContratistaMandante).filter_by(mandante_id=mandante.id).all():
            servicio = session.query(Servicio).filter_by(
                contratista_mandante_id=rel.id, nombre="General"
            ).first()
            if not servicio:
                servicio = Servicio(
                    contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                    nombre="General", fecha_inicio=HOY, estado=EstadoServicio.ACTIVO,
                )
                session.add(servicio); session.flush()
                servicios_creados += 1

            asignados = {
                str(a.trabajador_id)
                for a in session.query(ServicioTrabajador).filter_by(servicio_id=servicio.id).all()
            }
            for t in session.query(Trabajador).filter_by(empresa_id=rel.contratista_id).all():
                if str(t.id) not in asignados:
                    session.add(ServicioTrabajador(
                        servicio_id=servicio.id, trabajador_id=t.id,
                        activo=t.activo, fecha_asignacion=HOY,
                    ))
                    asignaciones_creadas += 1
    session.flush()

    # Ligar expedientes de requisitos alcance SERVICIO a su servicio "General"
    docs_sin_servicio = (
        session.query(Documento)
        .join(RequisitoDocumental, Documento.requisito_id == RequisitoDocumental.id)
        .filter(Documento.servicio_id.is_(None), RequisitoDocumental.alcance == Alcance.SERVICIO)
        .all()
    )
    ligados = 0
    for doc in docs_sin_servicio:
        empresa_id = doc.empresa_id or session.get(Trabajador, doc.trabajador_id).empresa_id
        rel = session.query(ContratistaMandante).filter_by(
            mandante_id=doc.mandante_id, contratista_id=empresa_id
        ).first()
        if not rel:
            continue
        servicio = session.query(Servicio).filter_by(
            contratista_mandante_id=rel.id, nombre="General"
        ).first()
        if servicio:
            doc.servicio_id = servicio.id
            ligados += 1
    if ligados:
        print(f"  OK {ligados} expediente(s) de alcance SERVICIO ligados a su servicio General.")

    if perfiles_creados or servicios_creados or asignaciones_creadas:
        print(f"  OK {perfiles_creados} perfil(es), {servicios_creados} servicio(s), "
              f"{asignaciones_creadas} asignación(es) de trabajadores.")
    else:
        print("  OK Perfiles y servicios ya existen, saltando.")


# ── Helpers documentos ────────────────────────────────────────────────────────

def _crear_expediente(session: Session, req: RequisitoDocumental, mandante_id,
                      estado: int, vigencia_dias: int | None, brecha: str | None,
                      empresa_id=None, trabajador_id=None):
    """Crea el expediente completo: documento + versión 1 + archivo demo + evento."""
    fecha_vig = _vigencia(vigencia_dias) if vigencia_dias and estado == 4 else None
    doc = Documento(
        requisito_id=req.id, mandante_id=mandante_id,
        empresa_id=empresa_id, trabajador_id=trabajador_id,
        estado=estado, fecha_vigencia_hasta=fecha_vig, mensaje_brecha=brecha,
    )
    session.add(doc); session.flush()

    version = DocumentoVersion(
        documento_id=doc.id, numero_version=1, estado=estado,
        mensaje_brecha=brecha, fecha_vigencia_hasta=fecha_vig,
    )
    session.add(version); session.flush()

    entidad = str(empresa_id or trabajador_id)[:8]
    session.add(ArchivoDocumento(
        documento_version_id=version.id, orden=0,
        storage_key=f"demo/documentos/{req.codigo.lower()}_{entidad}_{uuid_lib.uuid4().hex}.pdf",
        nombre_original=f"{req.codigo.lower()}.pdf",
        mime_type="application/pdf", tamaño_bytes=0, hash_sha256="0" * 64,
    ))
    session.add(DocumentoEvento(
        documento_id=doc.id, documento_version_id=version.id,
        tipo_evento=TipoEvento.SUBIDA, estado_nuevo=estado, detalle={"seed": True},
    ))
    doc.version_vigente_id = version.id


def _doc_empresa(session: Session, req: RequisitoDocumental, mandante_id, empresa_id,
                 estado: int, vigencia_dias: int | None = None, brecha: str | None = None):
    _crear_expediente(session, req, mandante_id, estado, vigencia_dias, brecha, empresa_id=empresa_id)


def _doc_trabajador(session: Session, req: RequisitoDocumental, mandante_id, trabajador_id,
                    estado: int, vigencia_dias: int | None = None, brecha: str | None = None):
    _crear_expediente(session, req, mandante_id, estado, vigencia_dias, brecha, trabajador_id=trabajador_id)


def _eliminar_documentos(session: Session, docs: list[Documento]):
    """Borra expedientes completos respetando las FKs (solo para limpieza de seed)."""
    for doc in docs:
        session.query(DocumentoEvento).filter_by(documento_id=doc.id).delete()
        doc.version_vigente_id = None
        session.flush()
        for v in session.query(DocumentoVersion).filter_by(documento_id=doc.id).all():
            session.query(ArchivoDocumento).filter_by(documento_version_id=v.id).delete()
            session.delete(v)
        session.delete(doc)


# ── Contratistas Codelco ──────────────────────────────────────────────────────

def seed_codelco_contratistas(session: Session, codelco: Mandante, reqs: dict):
    # Si ya existe Cóndor (la primera empresa del nuevo seed) se asume que todo está creado
    condor_ya_existe = session.query(EmpresaContratista).filter_by(rut="76.111.222-3").first()
    if condor_ya_existe:
        print("  OK Contratistas Codelco ya existen, saltando.")
        return

    # Limpiar contratistas viejos del seed anterior (Constructora Demo SpA, etc.)
    for rel in session.query(ContratistaMandante).filter_by(mandante_id=codelco.id).all():
        empresa = session.get(EmpresaContratista, rel.contratista_id)
        # Borrar servicios, documentos, trabajadores, usuarios y la relación
        _eliminar_documentos(session, session.query(Documento).filter_by(empresa_id=empresa.id).all())
        for t in session.query(Trabajador).filter_by(empresa_id=empresa.id).all():
            _eliminar_documentos(session, session.query(Documento).filter_by(trabajador_id=t.id).all())
        for s in session.query(Servicio).filter_by(contratista_mandante_id=rel.id).all():
            session.query(ServicioTrabajador).filter_by(servicio_id=s.id).delete()
            session.delete(s)
        session.query(Trabajador).filter_by(empresa_id=empresa.id).delete()
        session.query(Usuario).filter_by(contratista_id=empresa.id).delete()
        session.delete(rel)
        session.delete(empresa)
    session.flush()
    print("  OK Contratistas viejos de Codelco eliminados, creando nuevos...")

    mid = codelco.id
    r = reqs  # alias corto

    # 1 — Constructora Cóndor SpA — ACREDITADA
    condor = EmpresaContratista(rut="76.111.222-3", razon_social="Constructora Cóndor SpA",
                                giro="Construcción de obras civiles")
    session.add(condor); session.flush()
    session.add(ContratistaMandante(contratista_id=condor.id, mandante_id=mid, estado_acreditacion="ACREDITADA"))
    session.add(Usuario(email="contratista@demo.cl", nombre="Admin Constructora Cóndor",
                        password_hash=_hash("demo123"), rol="contratista_admin",
                        activo=True, contratista_id=condor.id))

    # trabajadores condor
    pedro = Trabajador(empresa_id=condor.id, rut="12.345.678-9", nombre_completo="Pedro González Rojas",
                       cargo="Jefe de Obra", activo=True)
    maria = Trabajador(empresa_id=condor.id, rut="9.876.543-2", nombre_completo="María Soto Vargas",
                       cargo="Prevencionista", activo=True)
    session.add_all([pedro, maria]); session.flush()

    for codigo in ["F30","F30_1","MIPER","RIOHS","DAS","CARPETA_TRIBUTARIA","VIGENCIA_SOCIEDAD","DJ_CONFLICTO"]:
        _doc_empresa(session, r[codigo], mid, condor.id, 4, 90)
    _doc_trabajador(session, r["CONTRATO"], mid, pedro.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, pedro.id, 4, 365)
    _doc_trabajador(session, r["CONTRATO"], mid, maria.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, maria.id, 4, 365)

    # 2 — Ingeniería Subterránea Ltda — EN_PROCESO
    subterranea = EmpresaContratista(rut="77.333.444-5", razon_social="Ingeniería Subterránea Ltda",
                                     giro="Servicios de ingeniería minera")
    session.add(subterranea); session.flush()
    session.add(ContratistaMandante(contratista_id=subterranea.id, mandante_id=mid, estado_acreditacion="EN_PROCESO"))

    luis = Trabajador(empresa_id=subterranea.id, rut="15.234.567-8", nombre_completo="Luis Herrera Castro",
                      cargo="Ingeniero Civil", activo=True)
    session.add(luis); session.flush()

    _doc_empresa(session, r["F30"], mid, subterranea.id, 4, 25)
    _doc_empresa(session, r["F30_1"], mid, subterranea.id, 2)      # en análisis
    _doc_empresa(session, r["MIPER"], mid, subterranea.id, 4, 300)
    _doc_empresa(session, r["RIOHS"], mid, subterranea.id, 4, 300)
    _doc_empresa(session, r["DAS"], mid, subterranea.id, 1)        # enviado
    _doc_empresa(session, r["CARPETA_TRIBUTARIA"], mid, subterranea.id, 4, 60)
    _doc_empresa(session, r["VIGENCIA_SOCIEDAD"], mid, subterranea.id, 4, 300)
    _doc_empresa(session, r["DJ_CONFLICTO"], mid, subterranea.id, 4, 300)
    _doc_trabajador(session, r["CONTRATO"], mid, luis.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, luis.id, 2)       # en análisis

    # 3 — Mantenciones del Norte SpA — BLOQUEADA
    mantenciones = EmpresaContratista(rut="78.555.666-7", razon_social="Mantenciones del Norte SpA",
                                      giro="Mantención industrial")
    session.add(mantenciones); session.flush()
    session.add(ContratistaMandante(contratista_id=mantenciones.id, mandante_id=mid, estado_acreditacion="BLOQUEADA"))

    jorge = Trabajador(empresa_id=mantenciones.id, rut="11.222.333-4", nombre_completo="Jorge Vega Muñoz",
                       cargo="Técnico Mecánico", activo=True)
    sandra = Trabajador(empresa_id=mantenciones.id, rut="16.789.012-3", nombre_completo="Sandra López Pérez",
                        cargo="Operadora", activo=True)
    session.add_all([jorge, sandra]); session.flush()

    _doc_empresa(session, r["F30"], mid, mantenciones.id, 3,
                 brecha="F30 rechazado: deuda previsional detectada de $2.345.000")
    _doc_empresa(session, r["F30_1"], mid, mantenciones.id, 3,
                 brecha="F30-1 vencido: fecha de vigencia expiró el 2026-03-15")
    _doc_empresa(session, r["MIPER"], mid, mantenciones.id, 4, 180)
    _doc_empresa(session, r["RIOHS"], mid, mantenciones.id, 4, 300)
    _doc_empresa(session, r["DAS"], mid, mantenciones.id, 1)
    _doc_empresa(session, r["CARPETA_TRIBUTARIA"], mid, mantenciones.id, 4, 60)
    _doc_empresa(session, r["VIGENCIA_SOCIEDAD"], mid, mantenciones.id, 4, 300)
    _doc_empresa(session, r["DJ_CONFLICTO"], mid, mantenciones.id, 4, 300)
    _doc_trabajador(session, r["CONTRATO"], mid, jorge.id, 3,
                    brecha="Contrato no vigente: fecha término 2026-04-01")
    _doc_trabajador(session, r["EXAM_MED"], mid, jorge.id, 4, 180)
    _doc_trabajador(session, r["CONTRATO"], mid, sandra.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, sandra.id, 4, 180)

    # 4 — Transportes Altiplano Ltda — EN_PROCESO (sin docs aún)
    transp = EmpresaContratista(rut="79.777.888-9", razon_social="Transportes Altiplano Ltda",
                                giro="Transporte de carga minera")
    session.add(transp); session.flush()
    session.add(ContratistaMandante(contratista_id=transp.id, mandante_id=mid, estado_acreditacion="EN_PROCESO"))
    t1 = Trabajador(empresa_id=transp.id, rut="13.111.222-3", nombre_completo="Roberto Fuentes Díaz",
                    cargo="Conductor", activo=True)
    t2 = Trabajador(empresa_id=transp.id, rut="14.333.444-5", nombre_completo="Carmen Silva Vega",
                    cargo="Supervisora", activo=True)
    session.add_all([t1, t2])

    # 5 — Excavaciones Cobre SpA — ACREDITADA
    excav = EmpresaContratista(rut="80.999.111-2", razon_social="Excavaciones Cobre SpA",
                               giro="Excavación y movimiento de tierras")
    session.add(excav); session.flush()
    session.add(ContratistaMandante(contratista_id=excav.id, mandante_id=mid, estado_acreditacion="ACREDITADA"))
    e1 = Trabajador(empresa_id=excav.id, rut="17.555.666-7", nombre_completo="Felipe Morales Castro",
                    cargo="Operador de Maquinaria", activo=True)
    e2 = Trabajador(empresa_id=excav.id, rut="18.777.888-9", nombre_completo="Andrea Rojas Pérez",
                    cargo="Capataz", activo=True)
    session.add_all([e1, e2]); session.flush()
    for codigo in ["F30","F30_1","MIPER","RIOHS","DAS","CARPETA_TRIBUTARIA","VIGENCIA_SOCIEDAD","DJ_CONFLICTO"]:
        _doc_empresa(session, r[codigo], mid, excav.id, 4, 75)
    _doc_trabajador(session, r["CONTRATO"], mid, e1.id, 4, 300)
    _doc_trabajador(session, r["EXAM_MED"], mid, e1.id, 4, 300)
    _doc_trabajador(session, r["CONTRATO"], mid, e2.id, 4, 300)
    _doc_trabajador(session, r["EXAM_MED"], mid, e2.id, 4, 300)

    # 6 — Servicios Mineros del Pacífico SA — EN_PROCESO
    pacif = EmpresaContratista(rut="81.222.333-4", razon_social="Servicios Mineros del Pacífico SA",
                               giro="Servicios especializados minería")
    session.add(pacif); session.flush()
    session.add(ContratistaMandante(contratista_id=pacif.id, mandante_id=mid, estado_acreditacion="EN_PROCESO"))
    p1 = Trabajador(empresa_id=pacif.id, rut="19.444.555-6", nombre_completo="Diego Contreras Muñoz",
                    cargo="Ingeniero de Minas", activo=True)
    session.add(p1); session.flush()
    _doc_empresa(session, r["F30"], mid, pacif.id, 4, 20)
    _doc_empresa(session, r["F30_1"], mid, pacif.id, 4, 20)
    _doc_empresa(session, r["MIPER"], mid, pacif.id, 2)
    _doc_empresa(session, r["RIOHS"], mid, pacif.id, 4, 300)
    _doc_empresa(session, r["DAS"], mid, pacif.id, 4, 300)
    _doc_empresa(session, r["CARPETA_TRIBUTARIA"], mid, pacif.id, 4, 80)
    _doc_empresa(session, r["VIGENCIA_SOCIEDAD"], mid, pacif.id, 1)
    _doc_empresa(session, r["DJ_CONFLICTO"], mid, pacif.id, 4, 300)
    _doc_trabajador(session, r["CONTRATO"], mid, p1.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, p1.id, 1)

    # 7 — Montajes Industriales Tarapacá Ltda — BLOQUEADA
    montajes = EmpresaContratista(rut="82.444.555-6", razon_social="Montajes Industriales Tarapacá Ltda",
                                  giro="Montajes electromecánicos")
    session.add(montajes); session.flush()
    session.add(ContratistaMandante(contratista_id=montajes.id, mandante_id=mid, estado_acreditacion="BLOQUEADA"))
    m1 = Trabajador(empresa_id=montajes.id, rut="20.666.777-8", nombre_completo="Héctor Ramírez Torres",
                    cargo="Técnico Electricista", activo=True)
    session.add(m1); session.flush()
    _doc_empresa(session, r["F30"], mid, montajes.id, 3,
                 brecha="F30 rechazado: cotizaciones previsionales no pagadas (3 meses)")
    _doc_empresa(session, r["F30_1"], mid, montajes.id, 1)
    _doc_empresa(session, r["MIPER"], mid, montajes.id, 4, 180)
    _doc_empresa(session, r["RIOHS"], mid, montajes.id, 4, 300)
    _doc_empresa(session, r["DAS"], mid, montajes.id, 4, 300)
    _doc_empresa(session, r["CARPETA_TRIBUTARIA"], mid, montajes.id, 4, 60)
    _doc_empresa(session, r["VIGENCIA_SOCIEDAD"], mid, montajes.id, 4, 300)
    _doc_empresa(session, r["DJ_CONFLICTO"], mid, montajes.id, 4, 300)
    _doc_trabajador(session, r["CONTRATO"], mid, m1.id, 4, 365)
    _doc_trabajador(session, r["EXAM_MED"], mid, m1.id, 3, brecha="Examen médico vencido desde 2026-01-15")
    print("  OK 7 contratistas Codelco con trabajadores y documentos creados.")


# ── Contratistas bulk (otros mandantes) ───────────────────────────────────────

def _contratista_bulk(session: Session, rut, nombre, giro, mandante_id, estado):
    e = EmpresaContratista(rut=rut, razon_social=nombre, giro=giro)
    session.add(e); session.flush()
    session.add(ContratistaMandante(contratista_id=e.id, mandante_id=mandante_id, estado_acreditacion=estado))
    return e


def seed_otros_mandantes(session: Session, mandantes: dict, reqs: dict):
    if session.query(ContratistaMandante).filter_by(mandante_id=mandantes["los-pelambres"].id).count() > 0:
        print("  OK Contratistas otros mandantes ya existen, saltando.")
        return

    pel_id = mandantes["los-pelambres"].id
    ech_id = mandantes["echeverria-izquierdo"].id
    ena_id = mandantes["enap-refinerias"].id

    # Los Pelambres — 12 contratistas (9 ACREDITADA, 2 EN_PROCESO, 1 BLOQUEADA)
    pelambres_data = [
        ("83.001.002-3", "Ingeniería Cobre Norte SA", "Ingeniería minera", "ACREDITADA"),
        ("83.003.004-5", "Construcciones Andinas SpA", "Obras civiles", "ACREDITADA"),
        ("83.005.006-7", "Servicios Industriales Andes Ltda", "Mantención industrial", "ACREDITADA"),
        ("83.007.008-9", "Transportes Mineros del Norte SA", "Transporte", "ACREDITADA"),
        ("83.009.010-1", "Electromecánica Atacama SpA", "Montajes", "ACREDITADA"),
        ("83.011.012-3", "Contratistas Especializados Ltda", "Servicios mineros", "ACREDITADA"),
        ("83.013.014-5", "Maquinaria Pesada del Pacífico SA", "Arriendo equipos", "ACREDITADA"),
        ("83.015.016-7", "Laboratorio Minero SpA", "Análisis de muestras", "ACREDITADA"),
        ("83.017.018-9", "Geología Aplicada Norte Ltda", "Geología", "ACREDITADA"),
        ("83.019.020-1", "Constructora Altura Ltda", "Construcción", "EN_PROCESO"),
        ("83.021.022-3", "Drilling Services Chile SA", "Perforación", "EN_PROCESO"),
        ("83.023.024-5", "Explosivos del Norte SpA", "Tronadura", "BLOQUEADA"),
    ]
    for rut, nombre, giro, estado in pelambres_data:
        _contratista_bulk(session, rut, nombre, giro, pel_id, estado)

    # Echeverría — 8 contratistas (5 ACREDITADA, 2 EN_PROCESO, 1 BLOQUEADA)
    ech_data = [
        ("84.001.002-3", "Suministros Construcción SA", "Materiales", "ACREDITADA"),
        ("84.003.004-5", "Electricistas Metropolitanos Ltda", "Electricidad", "ACREDITADA"),
        ("84.005.006-7", "Pinturas y Recubrimientos SpA", "Pintura industrial", "ACREDITADA"),
        ("84.007.008-9", "Grúas y Elevadores Chile SA", "Arriendo grúas", "ACREDITADA"),
        ("84.009.010-1", "Topografía Digital Ltda", "Topografía", "ACREDITADA"),
        ("84.011.012-3", "Hormigón Proyectado SpA", "Hormigones", "EN_PROCESO"),
        ("84.013.014-5", "Ventilación Industrial SA", "HVAC", "EN_PROCESO"),
        ("84.015.016-7", "Andamios Seguros Ltda", "Andamiaje", "BLOQUEADA"),
    ]
    for rut, nombre, giro, estado in ech_data:
        _contratista_bulk(session, rut, nombre, giro, ech_id, estado)

    # ENAP — 4 contratistas (2 ACREDITADA, 1 EN_PROCESO, 1 BLOQUEADA)
    ena_data = [
        ("85.001.002-3", "Refinería Servicios SpA", "Mantenimiento refinerías", "ACREDITADA"),
        ("85.003.004-5", "Química Industrial del Sur SA", "Productos químicos", "ACREDITADA"),
        ("85.005.006-7", "Ingeniería Petroquímica Ltda", "Ingeniería", "EN_PROCESO"),
        ("85.007.008-9", "Transporte Combustibles SA", "Transporte", "BLOQUEADA"),
    ]
    for rut, nombre, giro, estado in ena_data:
        _contratista_bulk(session, rut, nombre, giro, ena_id, estado)

    print("  OK 24 contratistas bulk creados para Los Pelambres, Echeverría y ENAP.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n--- Seed Acredita ---")
    with Session(engine) as session:
        seed_admin(session)
        reqs = seed_pilares(session)
        session.flush()
        mandantes = seed_mandantes(session)
        session.flush()
        seed_codelco_contratistas(session, mandantes["codelco-demo"], reqs)
        session.flush()
        seed_otros_mandantes(session, mandantes, reqs)
        session.flush()
        seed_perfiles_y_servicios(session, reqs)
        session.commit()
    print("\nCredenciales de acceso:")
    print("  admin@berisa.cl       / admin123  (berisa_admin)")
    print("  mandante@demo.cl      / demo123   (mandante_admin — Codelco)")
    print("  contratista@demo.cl   / demo123   (contratista_admin — Cóndor SpA)")
    print("--- Listo ---\n")


if __name__ == "__main__":
    main()
