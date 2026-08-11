import logging
import uuid
import secrets
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.schemas import (
    DefinirPermisosRequest,
    InvitarMandanteRequest,
    InvitarUsuarioMandanteRequest,
    UsuarioMandanteResponse,
    ActualizarMandanteRequest,
    AplicarPlantillaRequest,
    ConfigurarRequisitoPerfilRequest,
    DefinirCargosRequisitoRequest,
    CrearMandanteRequest,
    CrearPerfilRequest,
    InvitarContratistaRequest,
    MandanteResponse,
    PerfilResponse,
)
from app.core.config import settings
from app.core.exceptions import PermisoInsuficiente
from app.core.exceptions import PerfilNoEncontrado
from app.domain import permiso_service, acreditacion_service, plantillas, servicio_service, usuario_service
from app.domain.estados import EntidadTipo, EstadoDocumento
from app.domain.reglas_service import VIGENCIA_DEFAULT_DIAS
from app.models.cargo import Cargo
from app.models.servicio import PerfilRequisitos, PerfilRequisitoConfig, PerfilRequisitoCargo
from app.infrastructure.database import get_db
from app.infrastructure.email import Email, get_email_cliente
from app.middleware.auth import mandante_propio, require_rol
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, AcreditacionEvento, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.trabajador import Trabajador
from app.models.permiso import UsuarioPilarPermiso
from app.models.usuario import Usuario

logger = logging.getLogger("acredita")

router = APIRouter()



@router.post("/", response_model=MandanteResponse, status_code=status.HTTP_201_CREATED)
def crear_mandante(
    body: CrearMandanteRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin"])),
):
    """Crea un nuevo mandante en la plataforma. Solo berisa_admin."""
    if db.query(Mandante).filter_by(rut=body.rut).first():
        raise HTTPException(status_code=400, detail="Ya existe un mandante con ese RUT")

    mandante = Mandante(
        razon_social=body.razon_social,
        rut=body.rut,
        slug=body.slug,
        activo=True,
    )
    db.add(mandante)
    db.commit()
    db.refresh(mandante)
    return mandante


@router.patch("/{mandante_id}", response_model=MandanteResponse)
def actualizar_mandante(
    mandante_id: uuid.UUID,
    body: ActualizarMandanteRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Actualiza los datos de la organización. El mandante_admin solo la suya."""
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede editar su propio mandante")
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    if body.razon_social is not None:
        mandante.razon_social = body.razon_social
    if body.email_contacto is not None:
        mandante.email_contacto = body.email_contacto
    if body.sitio_web is not None:
        mandante.sitio_web = body.sitio_web
    db.commit()
    db.refresh(mandante)
    return mandante


# Va declarada ANTES de /{mandante_id}: FastAPI resuelve por orden y la ruta
# parametrica captura "plantillas" como si fuera un UUID (422).
@router.get("/plantillas")
def listar_plantillas(
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Plantillas de exigencia disponibles, con cuántos requisitos activa cada una."""
    return plantillas.resumen(db)


@router.get("/{mandante_id}", response_model=MandanteResponse)
def obtener_mandante(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(mandante_propio(["berisa_admin", "mandante_admin"])),
):
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")
    return mandante


@router.post("/invitar", status_code=status.HTTP_201_CREATED)
def invitar_mandante(
    body: InvitarMandanteRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin"])),
):
    """
    BERISA crea un mandante y su usuario mandante_admin inactivo, y le envía el
    email de activación. Mismo flujo con el que un mandante invita a un
    contratista: el invitado define su password y completa sus datos al activar.

    Solo berisa_admin: el catálogo de mandantes es del operador de la plataforma.
    """
    if db.query(Usuario).filter_by(email=body.email).first():
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un usuario con el email {body.email}. "
                   "Si el mandante ya fue invitado, pídale que active su cuenta desde el email recibido.",
        )
    if db.query(Mandante).filter_by(rut=body.rut).first():
        raise HTTPException(status_code=400, detail=f"Ya existe un mandante con el RUT {body.rut}.")

    slug = (body.slug or _slug_de(body.razon_social)).strip().lower()
    if db.query(Mandante).filter_by(slug=slug).first():
        raise HTTPException(
            status_code=400,
            detail=f"El identificador '{slug}' ya está en uso. Indica un slug distinto.",
        )

    mandante = Mandante(
        razon_social=body.razon_social, rut=body.rut, slug=slug,
        plan=body.plan, email_contacto=body.email, activo=True,
    )
    db.add(mandante)
    db.flush()

    nuevo_usuario = Usuario(
        email=body.email, nombre=body.razon_social, password_hash="",
        rol="mandante_admin", activo=False, mandante_id=mandante.id,
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    link_activacion = f"{settings.FRONTEND_URL}/activar?token={nuevo_usuario.id}"
    try:
        get_email_cliente().enviar(Email(
            destinatario=body.email,
            asunto="Invitación a Acredita",
            cuerpo_html=f"""
            <h2>Bienvenido a Acredita</h2>
            <p>BERISA creó la cuenta de <strong>{body.razon_social}</strong> en Acredita,
            la plataforma con la que vas a acreditar a tus empresas contratistas.</p>
            <p>Para activarla y definir tu contraseña:</p>
            <a href="{link_activacion}">Activar cuenta</a>
            <p>Este enlace es personal e intransferible.</p>
            """,
        ))
    except Exception:
        logger.exception("No se pudo enviar el email de invitación a %s", body.email)
        # El link se devuelve solo al admin que hizo la invitacion, en su propia
        # respuesta autenticada. Nunca se loguea. Es un respaldo mientras el
        # dominio de envio no este verificado en Resend.
        return {
            "mensaje": f"Mandante creado, pero el email de invitación a {body.email} no pudo enviarse.",
            "link_activacion": link_activacion,
            "mandante_id": str(mandante.id),
        }

    return {"mensaje": f"Invitación enviada a {body.email}", "mandante_id": str(mandante.id)}


def _slug_de(razon_social: str) -> str:
    """Identificador url-safe derivado de la razón social."""
    import re
    import unicodedata
    sin_tildes = unicodedata.normalize("NFKD", razon_social).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")[:50]


@router.post("/{mandante_id}/invitar-contratista", status_code=status.HTTP_201_CREATED)
def invitar_contratista(
    mandante_id: uuid.UUID,
    body: InvitarContratistaRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Crea una empresa contratista y un usuario contratista_admin inactivo.
    Envía email de invitación con un token (el usuario_id) para que active su cuenta.
    El token expira al ser usado (no hay TTL por ahora — Fase 2).
    El mandante_admin solo puede invitar a su propio mandante.
    """
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede invitar contratistas a su propio mandante")
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    # El RUT se resuelve ANTES que el email a propósito. Al revés —que es como
    # estaba— un mandante no podía sumar a su cartera a una empresa que ya
    # trabajaba para otro cliente: el email de su administrador ya existía y el
    # handler cortaba ahí, aconsejando "pídale que active su cuenta" a alguien
    # que la tenía activa hace meses. Eso contradice la premisa del producto,
    # que un documento se suba una vez y sirva para todos los mandantes que lo
    # exijan: para eso el segundo mandante tiene que engancharse a la MISMA
    # empresa, no a una copia.
    empresa_existente = db.query(EmpresaContratista).filter_by(rut=body.rut).first()
    usuario_existente = db.query(Usuario).filter_by(email=body.email).first()

    if empresa_existente:
        empresa = empresa_existente
        if db.query(ContratistaMandante).filter_by(contratista_id=empresa.id, mandante_id=mandante_id).first():
            raise HTTPException(
                status_code=400,
                detail=f"{empresa.razon_social} ya está vinculada a este mandante.",
            )
        # La empresa ya está en la plataforma y quien figura como contacto ya es
        # su administrador: no hay nada que invitar, sólo que vincular. Crear un
        # segundo usuario acá dejaba a la empresa con un contratista_admin por
        # cliente, cada uno con su propia clave que mantener.
        if usuario_existente and usuario_existente.contratista_id == empresa.id:
            db.add(ContratistaMandante(contratista_id=empresa.id, mandante_id=mandante_id))
            db.commit()
            return {
                "mensaje": f"{empresa.razon_social} ya estaba en la plataforma y quedó vinculada a "
                           f"{mandante.razon_social}. Verá tus exigencias con su cuenta actual; "
                           "no hace falta que active nada.",
                "empresa_existente": True,
            }

    # Un email que ya existe y NO es el administrador de esta empresa sí es un
    # conflicto real: dos empresas distintas no pueden compartir cuenta.
    if usuario_existente:
        raise HTTPException(
            status_code=400,
            detail=f"El email {body.email} ya pertenece a otra cuenta de la plataforma. "
                   "Usa el correo del administrador de esta empresa, o uno distinto.",
        )

    if not empresa_existente:
        empresa = EmpresaContratista(rut=body.rut, razon_social=body.razon_social)
        db.add(empresa)
        db.flush()

    db.add(ContratistaMandante(contratista_id=empresa.id, mandante_id=mandante_id))

    nuevo_usuario = Usuario(
        email=body.email,
        nombre=body.razon_social,
        password_hash="",
        rol="contratista_admin",
        activo=False,
        contratista_id=empresa.id,
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    link_activacion = f"{settings.FRONTEND_URL}/activar?token={nuevo_usuario.id}"

    try:
        get_email_cliente().enviar(Email(
            destinatario=body.email,
            asunto=f"Invitación a acreditarse ante {mandante.razon_social}",
            cuerpo_html=f"""
            <h2>Bienvenido a Acredita</h2>
            <p>{mandante.razon_social} te invita a acreditarte como empresa contratista.</p>
            <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
            <a href="{link_activacion}">Activar cuenta</a>
            <p>Este enlace es personal e intransferible.</p>
            """,
        ))
    except Exception:
        logger.exception("No se pudo enviar el email de invitación a %s", body.email)
        # El link solo se expone aca al admin que hizo la invitacion (via su
        # propia respuesta autenticada) -- nunca se loguea ni se muestra a
        # nadie mas. Es un respaldo temporal mientras el dominio de envio no
        # este verificado; una vez que lo este, este caso deja de ocurrir.
        return {
            "mensaje": f"Contratista creado, pero el email de invitación a {body.email} no pudo enviarse.",
            "link_activacion": link_activacion,
        }

    return {"mensaje": f"Invitación enviada a {body.email}"}


@router.get("/{mandante_id}/contratistas")
def listar_contratistas(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(mandante_propio(["berisa_admin", "mandante_admin"])),
):
    """Lista todas las empresas contratistas vinculadas a este mandante con su estado global."""
    relaciones = (
        db.query(ContratistaMandante)
        .filter_by(mandante_id=mandante_id)
        .all()
    )
    return [
        {
            "contratista_id": str(r.contratista_id),
            "razon_social": r.contratista.razon_social,
            "rut": r.contratista.rut,
            "estado_acreditacion": r.estado_acreditacion,
        }
        for r in relaciones
    ]


# Aqui vivian GET /{mandante_id}/dashboard y GET /{mandante_id}/reportes.
#
# Se eliminan en vez de arreglarse: ninguna pantalla los llamaba —el portal
# del mandante se arma con /contratistas-detalle y /requisitos— y arrastraban
# defectos propios que habria que mantener sin que nadie los mire. Una ruta
# muerta con bugs es peor que ninguna: el dia que alguien la use va a creer
# que lo que devuelve es cierto.
#
# Si vuelve a hacer falta un tablero, se escribe contra la evaluacion actual
# de acreditacion_service, que es la unica fuente que hoy dice la verdad.

@router.get("/{mandante_id}/contratistas-detalle")
def contratistas_detalle(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(mandante_propio(["berisa_admin", "mandante_admin"])),
):
    """
    Lista completa de contratistas con pilares, documentos y trabajadores,
    evaluados contra los perfiles de sus servicios activos.
    """
    rels = db.query(ContratistaMandante).filter_by(mandante_id=mandante_id).all()
    resultado = []

    def _doc_dict(item) -> dict:
        return {
            "requisito_id": str(item.requisito_id),
            "requisito_codigo": item.requisito_codigo,
            "requisito_nombre": item.requisito_nombre,
            "entidad_tipo": item.entidad_tipo,
            "pilar_codigo": item.pilar_codigo,
            "pilar_nombre": item.pilar_nombre,
            "servicio_nombre": item.servicio_nombre,
            "estado": item.estado,
            "fecha_vigencia_hasta": item.fecha_vigencia_hasta.isoformat() if item.fecha_vigencia_hasta else None,
            "mensaje_brecha": item.mensaje_brecha,
            "documento_id": str(item.documento_id) if item.documento_id else None,
            "aprobado_por_excepcion": item.aprobado_por_excepcion,
        }

    for rel in rels:
        empresa = rel.contratista
        ev = acreditacion_service.evaluar_relacion(db, rel.contratista_id, mandante_id)

        pilares_data = []
        for pilar in ev.pilares_empresa:
            docs_pilar = [
                _doc_dict(i) for i in ev.items_empresa if i.pilar_codigo == pilar.pilar_codigo
            ]
            pilares_data.append({
                "codigo": pilar.pilar_codigo,
                "nombre": pilar.pilar_nombre,
                "color": pilar.pilar_color,
                "cumple": pilar.cumple,
                "documentos": docs_pilar,
            })

        cargos = {
            str(t.id): t
            for t in db.query(Trabajador).filter_by(empresa_id=empresa.id).all()
        }
        trabajadores_data = []
        for t in ev.trabajadores:
            items_t = ev.items_trabajadores.get(str(t.trabajador_id), [])
            trabajador = cargos.get(str(t.trabajador_id))
            trabajadores_data.append({
                "id": str(t.trabajador_id),
                "nombre": t.nombre,
                "rut": t.rut,
                "cargo": trabajador.cargo if trabajador else None,
                "activo": True,
                "cumple": t.cumple,
                "documentos": [_doc_dict(i) for i in items_t],
            })

        resultado.append({
            "id": str(empresa.id),
            "razon_social": empresa.razon_social,
            "rut": empresa.rut,
            "giro": empresa.giro,
            "estado_acreditacion": rel.estado_acreditacion,
            "total_trabajadores": len(trabajadores_data),
            "pilares": pilares_data,
            "trabajadores": trabajadores_data,
        })

    return resultado


@router.get("/{mandante_id}/configuracion")
def configuracion_mandante(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(mandante_propio(["berisa_admin", "mandante_admin"])),
):
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    equipo = db.query(Usuario).filter_by(mandante_id=mandante_id).all()
    equipo_data = []
    for u in equipo:
        # None = aprueba todos los pilares (mandante_admin); lista vacia = ninguno.
        pilares = permiso_service.pilares_que_aprueba(db, u)
        equipo_data.append({
            "id": str(u.id), "nombre": u.nombre, "email": u.email,
            "rol": u.rol, "activo": u.activo,
            "pilares": None if pilares is None else [p.nombre for p in pilares],
            "pilar_ids": [] if pilares is None else [str(p.id) for p in pilares],
        })

    return {
        "id": str(mandante.id),
        "razon_social": mandante.razon_social,
        "rut": mandante.rut,
        "email_contacto": mandante.email_contacto or "",
        "sitio_web": mandante.sitio_web or "",
        "plan": mandante.plan,
        "activo": mandante.activo,
        "equipo": equipo_data,
    }


@router.get("/{mandante_id}/requisitos")
def listar_requisitos_mandante(
    mandante_id: uuid.UUID,
    perfil_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(mandante_propio(["berisa_admin", "mandante_admin"])),
):
    """
    Catálogo de pilares/requisitos con la config del perfil superpuesta.
    Sin perfil_id usa el perfil "General" del mandante.
    """
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")

    perfil = db.get(PerfilRequisitos, perfil_id) if perfil_id else _perfil_por_defecto(db, mandante_id)
    if not perfil or perfil.mandante_id != mandante_id:
        raise HTTPException(status_code=404, detail="Perfil no encontrado para este mandante")

    configs = {
        str(c.requisito_documental_id): c
        for c in db.query(PerfilRequisitoConfig).filter_by(perfil_id=perfil.id).all()
    }

    pilares = db.query(Pilar).order_by(Pilar.orden).all()
    resultado = []
    for pilar in pilares:
        requisitos = []
        for sp in sorted(pilar.subpilares, key=lambda x: x.orden):
            for req in sp.requisitos:
                # Requisito propio de OTRO mandante -- nunca visible aquí.
                if req.mandante_id is not None and req.mandante_id != mandante_id:
                    continue
                cfg = configs.get(str(req.id))
                requisitos.append({
                    "id": str(req.id),
                    "codigo": req.codigo,
                    "nombre": req.nombre,
                    "descripcion": req.descripcion or "",
                    "entidad": req.entidad_tipo,
                    "alcance": req.alcance,
                    # El subpilar viaja en cada requisito y NO como un nivel más
                    # de anidamiento: la lista plana por pilar la consumen ya
                    # varias pantallas, y anidar habría obligado a tocarlas todas.
                    # Con esto el cliente agrupa si quiere y sigue funcionando si
                    # no lo hace.
                    "subpilar_id": str(sp.id),
                    "subpilar_codigo": sp.codigo,
                    "subpilar_nombre": sp.nombre,
                    "subpilar_orden": sp.orden,
                    # BASE | AMPLIADO | OPCIONAL — por qué el mandante PUEDE
                    # exigirlo. Distinto de es_obligatorio, que es si lo exige.
                    "nivel": req.nivel,
                    "max_archivos": req.max_archivos,
                    "es_propio": req.mandante_id is not None,
                    # A qué cargos aplica dentro de este perfil. Lista vacía =
                    # aplica a todos los trabajadores, que es el default.
                    "cargo_ids": [str(pc.cargo_id) for pc in cfg.cargos] if cfg else [],
                    # Sin config en el perfil = el requisito NO se exige en él
                    "es_obligatorio": cfg.es_obligatorio if cfg else False,
                    "vigencia_max_dias": cfg.vigencia_max_dias if cfg else VIGENCIA_DEFAULT_DIAS,
                    "umbral_deuda_max": float(cfg.umbral_deuda_max) if cfg and cfg.umbral_deuda_max is not None else None,
                })
        resultado.append({
            "id": str(pilar.id),
            "codigo": pilar.codigo,
            "nombre": pilar.nombre,
            "descripcion": "",
            "color": pilar.color,
            "requisitos": requisitos,
        })
    return {
        "perfil": {
            "id": str(perfil.id),
            "nombre": perfil.nombre,
            "descripcion": perfil.descripcion,
        },
        "pilares": resultado,
    }


@router.get("/{mandante_id}/perfiles", response_model=list[PerfilResponse])
def listar_perfiles(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(mandante_propio(["berisa_admin", "mandante_admin"])),
):
    """Perfiles de requisitos del mandante (plantillas de exigencias por tipo de servicio)."""
    return servicio_service.listar_perfiles(db, mandante_id)


@router.post("/{mandante_id}/perfiles", response_model=PerfilResponse, status_code=status.HTTP_201_CREATED)
def crear_perfil(
    mandante_id: uuid.UUID,
    body: CrearPerfilRequest,
    db: Session = Depends(get_db),
    usuario=Depends(mandante_propio(["berisa_admin", "mandante_admin"])),
):
    if not db.get(Mandante, mandante_id):
        raise HTTPException(status_code=404, detail="Mandante no encontrado")
    return servicio_service.crear_perfil(db, mandante_id, body.nombre, body.descripcion)


@router.post("/{mandante_id}/perfiles/{perfil_id}/requisitos", status_code=status.HTTP_201_CREATED)
def configurar_requisito_perfil(
    mandante_id: uuid.UUID,
    perfil_id: uuid.UUID,
    body: ConfigurarRequisitoPerfilRequest,
    db: Session = Depends(get_db),
    usuario=Depends(mandante_propio(["berisa_admin", "mandante_admin"])),
):
    """Agrega o actualiza la parametrización de un requisito dentro del perfil."""
    try:
        perfil = servicio_service.obtener_perfil(db, perfil_id)
    except PerfilNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    if perfil.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="El perfil no pertenece a este mandante")

    servicio_service.configurar_requisito_perfil(
        db,
        perfil_id=perfil_id,
        requisito_documental_id=body.requisito_documental_id,
        es_obligatorio=body.es_obligatorio,
        vigencia_max_dias=body.vigencia_max_dias,
        umbral_deuda_max=body.umbral_deuda_max,
        parametros_extra=body.parametros_extra,
    )
    return {"mensaje": "Requisito configurado en el perfil"}


@router.put("/{mandante_id}/perfiles/{perfil_id}/requisitos/{requisito_id}/cargos")
def definir_cargos_requisito(
    mandante_id: uuid.UUID,
    perfil_id: uuid.UUID,
    requisito_id: uuid.UUID,
    body: DefinirCargosRequisitoRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    A qué cargos aplica este requisito dentro del perfil.

    Lista COMPLETA, no incremental: mandar `cargo_ids` vacío devuelve el requisito
    a "aplica a todos", que es el comportamiento por defecto. PUT y no POST
    justamente por eso.

    Solo tiene sentido en requisitos de entidad_tipo=TRABAJADOR: un documento de
    la empresa no depende del cargo de nadie, y aceptarlo ahí crearía una
    configuración que el dominio ignora en silencio.
    """
    try:
        perfil = servicio_service.obtener_perfil(db, perfil_id)
    except PerfilNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    if perfil.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="El perfil no pertenece a este mandante")
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede configurar perfiles de su propio mandante")

    requisito = db.get(RequisitoDocumental, requisito_id)
    if not requisito:
        raise HTTPException(status_code=404, detail="Requisito no encontrado")
    if requisito.entidad_tipo != EntidadTipo.TRABAJADOR:
        raise HTTPException(
            status_code=400,
            detail="Solo los requisitos de trabajador se pueden restringir por cargo",
        )

    config = db.query(PerfilRequisitoConfig).filter_by(
        perfil_id=perfil_id, requisito_documental_id=requisito_id
    ).first()
    if not config:
        raise HTTPException(
            status_code=404,
            detail="El requisito no está configurado en este perfil. Actívalo primero.",
        )

    cargos_validos = {
        c.id for c in db.query(Cargo).filter(Cargo.id.in_(body.cargo_ids)).all()
        if c.mandante_id is None or c.mandante_id == mandante_id
    } if body.cargo_ids else set()
    desconocidos = set(body.cargo_ids) - cargos_validos
    if desconocidos:
        raise HTTPException(
            status_code=400,
            detail="Hay cargos que no existen o no pertenecen a tu organización",
        )

    db.query(PerfilRequisitoCargo).filter_by(perfil_requisito_config_id=config.id).delete()
    for cargo_id in cargos_validos:
        db.add(PerfilRequisitoCargo(perfil_requisito_config_id=config.id, cargo_id=cargo_id))
    db.commit()

    return {
        "mensaje": "Aplicabilidad por cargo actualizada",
        "cargos": len(cargos_validos),
        "aplica_a_todos": len(cargos_validos) == 0,
    }


@router.post("/{mandante_id}/perfiles/{perfil_id}/plantilla")
def aplicar_plantilla_perfil(
    mandante_id: uuid.UUID,
    perfil_id: uuid.UUID,
    body: AplicarPlantillaRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Deja el perfil exigiendo lo que dice la plantilla, en un solo request.

    Sin esto, poner en marcha un perfil sobre el catálogo de 44 requisitos son 44
    POST desde la pantalla, uno por casilla. Es un SET: lo que la plantilla no
    incluye queda apagado, con su parametrización intacta por si se reactiva.
    """
    try:
        perfil = servicio_service.obtener_perfil(db, perfil_id)
    except PerfilNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    if perfil.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="El perfil no pertenece a este mandante")
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede configurar perfiles de su propio mandante")

    try:
        return servicio_service.aplicar_plantilla(db, perfil_id, body.plantilla.strip().upper())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))




# ── Usuarios del mandante y sus permisos de aprobación ────────────────────────

@router.get("/{mandante_id}/usuarios", response_model=list[UsuarioMandanteResponse])
def listar_usuarios_mandante(
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """El equipo del mandante con los pilares que cada uno puede aprobar."""
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede ver los usuarios de su propio mandante")

    resultado = []
    for u in db.query(Usuario).filter_by(mandante_id=mandante_id).order_by(Usuario.nombre).all():
        pilares = permiso_service.pilares_que_aprueba(db, u)
        resultado.append(UsuarioMandanteResponse(
            id=u.id, email=u.email, nombre=u.nombre, rol=u.rol, activo=u.activo,
            pilares=None if pilares is None else [p.nombre for p in pilares],
            pilar_ids=[] if pilares is None else [p.id for p in pilares],
            aprueba_todo=bool(u.aprueba_todo), cargo=u.cargo,
            pendiente=usuario_service.nunca_activo(u),
            es_uno_mismo=u.id == usuario.id,
        ))
    return resultado


@router.post("/{mandante_id}/invitar-usuario", status_code=status.HTTP_201_CREATED)
def invitar_usuario_mandante(
    mandante_id: uuid.UUID,
    body: InvitarUsuarioMandanteRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Invita a alguien de la organización del mandante a revisar documentos.

    Son dos decisiones independientes: si administra la cuenta (`rol`) y qué
    alcance de aprobación tiene (`aprueba_todo` o `pilar_ids`). Mismo flujo de
    activación que el resto: el invitado define su propia contraseña.
    """
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede invitar usuarios a su propio mandante")
    mandante = db.get(Mandante, mandante_id)
    if not mandante:
        raise HTTPException(status_code=404, detail="Mandante no encontrado")
    if body.rol not in ("mandante_admin", "prevencionista"):
        raise HTTPException(
            status_code=400,
            detail="El rol debe ser mandante_admin (administra la cuenta) o prevencionista.",
        )
    if db.query(Usuario).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail=f"Ya existe un usuario con el email {body.email}.")

    # Un mandante_admin ya aprueba todo por su rol; guardar además la marca sería
    # un segundo lugar donde dice lo mismo.
    aprueba_todo = body.aprueba_todo and body.rol not in permiso_service.ROLES_SIN_RESTRICCION

    nuevo = Usuario(
        email=body.email, nombre=body.nombre, password_hash="",
        rol=body.rol, activo=False, mandante_id=mandante_id,
        aprueba_todo=aprueba_todo, cargo=body.cargo or None,
    )
    db.add(nuevo)
    db.flush()

    # Sin filas por pilar cuando aprueba todo: una sola fuente de verdad del
    # alcance (mismo criterio que permiso_service.definir_permisos).
    if not permiso_service.aprueba_cualquier_pilar(nuevo) and body.pilar_ids:
        db.add_all([
            UsuarioPilarPermiso(usuario_id=nuevo.id, pilar_id=pid) for pid in body.pilar_ids
        ])
    db.commit()
    db.refresh(nuevo)

    link_activacion = f"{settings.FRONTEND_URL}/activar?token={nuevo.id}"
    try:
        get_email_cliente().enviar(Email(
            destinatario=body.email,
            asunto=f"Invitación a Acredita — {mandante.razon_social}",
            cuerpo_html=f"""
            <h2>Te invitaron a Acredita</h2>
            <p>{mandante.razon_social} te invitó a revisar la documentación de sus
            empresas contratistas.</p>
            <p>Para activar tu cuenta y definir tu contraseña:</p>
            <a href="{link_activacion}">Activar cuenta</a>
            <p>Este enlace es personal e intransferible.</p>
            """,
        ))
    except Exception:
        logger.exception("No se pudo enviar el email de invitación a %s", body.email)
        return {
            "mensaje": f"Usuario creado, pero el email a {body.email} no pudo enviarse.",
            "link_activacion": link_activacion,
        }

    return {"mensaje": f"Invitación enviada a {body.email}"}


@router.put("/{mandante_id}/usuarios/{usuario_id}/permisos", status_code=status.HTTP_204_NO_CONTENT)
def definir_permisos_usuario(
    mandante_id: uuid.UUID,
    usuario_id: uuid.UUID,
    body: DefinirPermisosRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Reemplaza el alcance de aprobación de este usuario."""
    if usuario.mandante_id and usuario.mandante_id != mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede cambiar permisos de su propio mandante")
    try:
        permiso_service.definir_permisos(
            db, usuario_id, mandante_id, body.pilar_ids, aprueba_todo=body.aprueba_todo
        )
    except PermisoInsuficiente as e:
        raise HTTPException(status_code=403, detail=str(e))
