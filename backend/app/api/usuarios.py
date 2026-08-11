import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy.orm import Session

from app.api.schemas import (
    ActivarCuentaRequest,
    ActualizarUsuarioRequest,
    CrearUsuarioRequest,
    InvitacionInfoResponse,
    InvitarMiembroEquipoRequest,
    LoginRequest,
    RecuperarPasswordRequest,
    RestablecerPasswordRequest,
    TokenResponse,
    UsuarioResponse,
)
from app.core.config import settings
from app.core.exceptions import AcreditaError, PermisoInsuficiente
from app.core.security import hash_password, verify_password
from app.domain import recuperacion_service, usuario_service
from app.infrastructure.database import get_db
from app.infrastructure.email import Email, get_email_cliente
from app.middleware.auth import get_usuario_actual, require_rol
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.mandante import Mandante
from app.models.permiso import UsuarioPilarPermiso
from app.models.usuario import Usuario

import logging
logger = logging.getLogger("acredita")

router = APIRouter()

ROLES_CREABLES = {
    "berisa_admin": ["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"],
    "mandante_admin": ["mandante_admin"],
    "contratista_admin": ["prevencionista"],
}


def _crear_token(usuario: Usuario, db: Session | None = None) -> str:
    # `mandante_id` solo aplica a usuarios DE un mandante. Antes, para un
    # contratista, se metía aquí "el primer vínculo" con un .first() sin
    # order_by: un contratista con tres clientes veía uno al azar y sin forma de
    # cambiarlo, y todo su portal quedaba cableado a ese. Un contratista no
    # pertenece a un mandante — trabaja para varios. Sus endpoints se derivan de
    # contratista_id (ver /mis-documentos y /mi-resumen).
    #
    # El backend nunca leyó este claim: get_usuario_actual carga el Usuario de
    # la BD por `sub`, así que quitarlo no afecta autorización.
    payload = {
        "sub": str(usuario.id),
        "rol": usuario.rol,
        "mandante_id": str(usuario.mandante_id) if usuario.mandante_id else None,
        "contratista_id": str(usuario.contratista_id) if usuario.contratista_id else None,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Autentica con email y password. Retorna JWT con rol, mandante_id
    o contratista_id según el tipo de usuario.
    """
    usuario = db.query(Usuario).filter_by(email=body.email, activo=True).first()
    if not usuario or not verify_password(body.password, usuario.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    return TokenResponse(
        access_token=_crear_token(usuario, db),
        rol=usuario.rol,
        mandante_id=usuario.mandante_id,
        contratista_id=usuario.contratista_id,
    )


@router.get("/invitacion/{token}", response_model=InvitacionInfoResponse)
def obtener_invitacion(token: str, db: Session = Depends(get_db)):
    """
    Datos de la invitación pendiente para prellenar el formulario de
    activación -- el contratista corrige/completa en vez de reescribir
    a ciegas lo que el mandante ya ingresó al invitar.
    """
    try:
        usuario_id = uuid.UUID(token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Token inválido")

    usuario = db.get(Usuario, usuario_id)
    if not usuario or usuario.activo:
        raise HTTPException(status_code=400, detail="Token inválido o cuenta ya activada")
    # Misma razón que en /activar: una cuenta revocada tiene activo=False, y sin
    # esto cualquiera con el UUID leía el email, el nombre y la organización de
    # alguien a quien justamente se le quitó el acceso.
    if not usuario_service.nunca_activo(usuario):
        raise HTTPException(status_code=400, detail="Token inválido o cuenta ya activada")

    # El superadmin de BERISA no tiene organización de la cual sacar los datos.
    # Sin este ramal la página de activación daba 404 y no había forma de
    # estrenar una instalación limpia sin entrar por SSH.
    if usuario.rol == "berisa_admin":
        return InvitacionInfoResponse(
            email=usuario.email,
            nombre=usuario.nombre,
            tipo="EQUIPO",
            organizacion="BERISA",
            razon_social="BERISA",
            rut="",
            giro=None,
            mandante_razon_social="",
            rol=usuario.rol,
        )

    if usuario.contratista_id:
        empresa = db.query(EmpresaContratista).filter_by(id=usuario.contratista_id).first()
        if not empresa:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
        relacion = (
            db.query(ContratistaMandante)
            .filter_by(contratista_id=empresa.id)
            .order_by(ContratistaMandante.created_at.desc())
            .first()
        )
        return InvitacionInfoResponse(
            email=usuario.email,
            nombre=usuario.nombre,
            tipo=_tipo_invitacion(db, usuario),
            organizacion=empresa.razon_social,
            razon_social=empresa.razon_social,
            rut=empresa.rut,
            giro=empresa.giro,
            mandante_razon_social=relacion.mandante.razon_social if relacion else "",
            rol=usuario.rol,
        )

    if usuario.mandante_id:
        mandante = db.get(Mandante, usuario.mandante_id)
        if not mandante:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
        return InvitacionInfoResponse(
            email=usuario.email,
            nombre=usuario.nombre,
            tipo=_tipo_invitacion(db, usuario),
            organizacion=mandante.razon_social,
            razon_social=mandante.razon_social,
            rut=mandante.rut,
            giro=None,
            # Vacío a propósito: a un mandante lo invita BERISA, no hay un
            # tercero por encima que mostrar.
            mandante_razon_social="",
            rol=usuario.rol,
        )

    raise HTTPException(status_code=404, detail="Invitación no encontrada")


def _tipo_invitacion(db: Session, invitado: Usuario) -> str:
    """
    ORGANIZACION si el invitado ES la empresa que se está dando de alta; EQUIPO
    si se suma a una que ya existe.

    Se decide por la presencia de OTRO usuario activo en la misma organización:
    cuando BERISA da de alta un mandante, ese mandante no tiene ningún usuario
    activo todavía; cuando un mandante invita a un colega, existe al menos el que
    invitó. No hace falta una columna nueva para saberlo.

    Importa porque de esto depende si el formulario de activación pide confirmar
    la razón social y el RUT. A un miembro del equipo no le corresponde editarlos
    —podría cambiar el RUT de su propia empresa— y además es confuso: lo único
    que tiene que hacer es elegir su contraseña.
    """
    # Un berisa_admin no cuelga de ninguna organización: ES BERISA. No hay razón
    # social ni RUT que confirmar, solo su contraseña.
    if invitado.rol == "berisa_admin":
        return "EQUIPO"
    q = db.query(Usuario).filter(Usuario.id != invitado.id, Usuario.activo.is_(True))
    if invitado.mandante_id:
        q = q.filter(Usuario.mandante_id == invitado.mandante_id)
    elif invitado.contratista_id:
        q = q.filter(Usuario.contratista_id == invitado.contratista_id)
    else:
        return "ORGANIZACION"
    return "EQUIPO" if q.first() else "ORGANIZACION"


# Respuesta única de /recuperar. Sale igual exista o no la cuenta: si dijera "no
# hay ninguna cuenta con ese email", el formulario se convertiría en un oráculo
# para averiguar quién está registrado en la plataforma.
_RESPUESTA_RECUPERACION = {
    "mensaje": "Si hay una cuenta activa con ese email, te enviamos un enlace para "
               "restablecer tu contraseña. Revisa tu correo."
}


@router.post("/recuperar")
def solicitar_recuperacion(body: RecuperarPasswordRequest, db: Session = Depends(get_db)):
    """
    Pide el enlace para restablecer la contraseña.

    Existe porque hasta ahora perder la clave era un callejón sin salida:
    dependía de que OTRO administrador de la organización te la devolviera, y una
    organización con un solo administrador —el caso normal al empezar— se quedaba
    sin nadie que pudiera hacerlo.

    Devuelve siempre lo mismo, incluso si el email no existe o la cuenta está
    revocada. Quien no puede recuperar simplemente no recibe correo.
    """
    usuario = db.query(Usuario).filter_by(email=body.email.strip()).first()
    if usuario and recuperacion_service.puede_recuperar(usuario):
        token = recuperacion_service.emitir_token(db, usuario)
        link = f"{settings.FRONTEND_URL}/restablecer?token={token}"
        try:
            get_email_cliente().enviar(Email(
                destinatario=usuario.email,
                asunto="Restablecer tu contraseña de Acredita",
                cuerpo_html=f"""
                <h2>Restablecer tu contraseña</h2>
                <p>Pediste volver a entrar a Acredita. Para elegir una contraseña nueva:</p>
                <a href="{link}">Restablecer contraseña</a>
                <p>El enlace vence en una hora y sirve una sola vez.</p>
                <p>Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.</p>
                """,
            ))
        except Exception:
            # No se filtra al que pide: sabría que la cuenta existe. Queda en el
            # log del servidor, sin el token.
            logger.exception("No se pudo enviar la recuperación a %s", usuario.email)
    return _RESPUESTA_RECUPERACION


@router.post("/restablecer", response_model=TokenResponse)
def restablecer_password(body: RestablecerPasswordRequest, db: Session = Depends(get_db)):
    """
    Consume el token y deja la contraseña nueva.

    Devuelve un JWT: quien acaba de demostrar que controla el email y eligió una
    contraseña queda dentro, sin un paso extra de login que sólo agregaría una
    pantalla más a un momento ya incómodo.
    """
    try:
        recuperacion_service.exigir_password_aceptable(body.password)
        usuario = recuperacion_service.consumir_token(db, body.token)
    except recuperacion_service.TokenRecuperacionInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AcreditaError as e:
        raise HTTPException(status_code=400, detail=str(e))

    usuario.password_hash = hash_password(body.password)
    db.commit()

    return TokenResponse(
        access_token=_crear_token(usuario, db),
        rol=usuario.rol,
        mandante_id=usuario.mandante_id,
        contratista_id=usuario.contratista_id,
    )


@router.post("/activar", response_model=TokenResponse)
def activar_cuenta(body: ActivarCuentaRequest, db: Session = Depends(get_db)):
    """
    Activa una cuenta invitada. El token es el usuario_id enviado en el email.

    Hay dos tipos de invitación y solo uno toca los datos de la organización:

    - ORGANIZACION: el invitado ES la empresa que se da de alta (BERISA invita a
      un mandante, un mandante invita a un contratista). Confirma o corrige su
      razón social y RUT.
    - EQUIPO: el invitado se suma a una organización que ya existe. Solo define su
      contraseña. Los datos de la empresa se IGNORAN aunque vengan en el body: no
      le corresponde editarlos, y sin este bloqueo un miembro nuevo del equipo
      podía cambiar el RUT de su propia empresa desde el formulario de activación.
    """
    try:
        usuario_id = uuid.UUID(body.token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Token inválido")

    usuario = db.get(Usuario, usuario_id)
    if not usuario or usuario.activo:
        raise HTTPException(status_code=400, detail="Token inválido o cuenta ya activada")
    # Solo se activa quien NUNCA definió contraseña. Sin esta condición bastaba
    # activo=False, y desde que DELETE /usuarios/{id} desactiva en vez de borrar,
    # una cuenta REVOCADA quedaba justo en ese estado: cualquiera con el UUID
    # podía volver a "activarla" con una contraseña nueva, SIN autenticarse, y
    # recuperaba el acceso que un administrador acababa de quitarle.
    #
    # El UUID no es un secreto —viaja en enlaces de invitación, en respuestas de
    # la API y en la URL de activación—, así que nunca fue material de
    # autenticación. La única defensa es que el estado no sea reactivable.
    if not usuario_service.nunca_activo(usuario):
        raise HTTPException(
            status_code=400,
            detail="Esta cuenta ya fue activada antes. Si perdiste el acceso, "
                   "pídele a un administrador de tu organización que te lo devuelva.",
        )

    es_equipo = _tipo_invitacion(db, usuario) == "EQUIPO"

    # Su propio nombre lo puede fijar cualquiera al activar, sea invitación de
    # equipo o de organización. Antes sólo se aceptaba en la de equipo, así que
    # el administrador de un mandante quedaba llamándose como la empresa —el
    # alta sólo pide razón social— y en Equipo aparecía "Minera del Norte SpA"
    # como si fuera una persona.
    if body.nombre:
        usuario.nombre = body.nombre

    if es_equipo:
        pass  # Nada de la organización: sus datos no le corresponden.
    elif not body.razon_social or not body.rut:
        raise HTTPException(
            status_code=400,
            detail="Falta la razón social o el RUT de la empresa.",
        )

    mandante = db.get(Mandante, usuario.mandante_id) if usuario.mandante_id else None
    if mandante and not es_equipo:
        if body.rut != mandante.rut:
            conflicto = db.query(Mandante).filter(
                Mandante.rut == body.rut, Mandante.id != mandante.id
            ).first()
            if conflicto:
                raise HTTPException(
                    status_code=400,
                    detail=f"El RUT {body.rut} ya está registrado por otro mandante "
                           f"({conflicto.razon_social}). Verifica el RUT ingresado.",
                )
        mandante.razon_social = body.razon_social
        mandante.rut = body.rut
        # Mandante no tiene giro; el campo del formulario se ignora.

    empresa = db.query(EmpresaContratista).filter_by(id=usuario.contratista_id).first()
    if empresa and not es_equipo:
        if body.rut != empresa.rut:
            conflicto = db.query(EmpresaContratista).filter(
                EmpresaContratista.rut == body.rut,
                EmpresaContratista.id != empresa.id,
            ).first()
            if conflicto:
                raise HTTPException(
                    status_code=400,
                    detail=f"El RUT {body.rut} ya está registrado por otra empresa "
                           f"({conflicto.razon_social}). Verifica el RUT ingresado.",
                )
        empresa.razon_social = body.razon_social
        empresa.rut = body.rut
        empresa.giro = body.giro

    usuario.password_hash = hash_password(body.password)
    usuario.activo = True
    db.commit()

    return TokenResponse(
        access_token=_crear_token(usuario, db),
        rol=usuario.rol,
        mandante_id=usuario.mandante_id,
        contratista_id=usuario.contratista_id,
    )


@router.get("/me", response_model=UsuarioResponse)
def obtener_usuario_actual(
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """Retorna los datos del usuario autenticado y su contexto (mandante o contratista)."""
    return usuario


@router.post("/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    body: CrearUsuarioRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin"])),
):
    """
    Crea un usuario adicional dentro del mismo mandante o contratista.
    berisa_admin puede crear cualquier rol.
    mandante_admin solo puede crear mandante_admin.
    contratista_admin solo puede crear prevencionista.
    """
    roles_permitidos = ROLES_CREABLES.get(usuario.rol, [])
    if body.rol not in roles_permitidos:
        raise HTTPException(status_code=403, detail=f"No puede crear usuarios con rol '{body.rol}'")

    if db.query(Usuario).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    nuevo = Usuario(
        email=body.email,
        nombre=body.nombre,
        password_hash=hash_password(body.password),
        rol=body.rol,
        activo=True,
        mandante_id=usuario.mandante_id,
        contratista_id=usuario.contratista_id,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


# ── Equipo de la propia organización ──────────────────────────────────────────
#
# Van declaradas ANTES de las rutas con {usuario_id}: FastAPI resuelve por orden
# y "mi-equipo" se parsearía como un UUID.
#
# La organización sale del TOKEN, nunca de la URL. Por eso no hay
# /contratistas/{id}/usuarios: sin id en la ruta no existe el caso de pedir el
# equipo de otra empresa, y la regla de tenant no se puede olvidar.

@router.get("/mi-equipo")
def listar_mi_equipo(
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_rol(["mandante_admin", "contratista_admin"])),
):
    """El equipo de la organización de quien pregunta, activos e invitados."""
    q = db.query(Usuario)
    if actor.contratista_id:
        q = q.filter(Usuario.contratista_id == actor.contratista_id)
    else:
        q = q.filter(Usuario.mandante_id == actor.mandante_id)

    return [
        {
            "id": str(u.id),
            "email": u.email,
            "nombre": u.nombre,
            "rol": u.rol,
            "cargo": u.cargo,
            "activo": u.activo,
            # Distingue "invitado que nunca entró" de "cuenta dada de baja".
            # Los dos tienen activo=False y en la UI son cosas muy distintas:
            # a uno se le reenvía la invitación, al otro se le reactiva.
            "pendiente": usuario_service.nunca_activo(u),
            "es_uno_mismo": u.id == actor.id,
        }
        for u in sorted(q.all(), key=lambda x: (not x.activo, x.nombre))
    ]


@router.post("/mi-equipo/invitar", status_code=status.HTTP_201_CREATED)
def invitar_a_mi_equipo(
    body: InvitarMiembroEquipoRequest,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_rol(["contratista_admin"])),
):
    """
    El contratista suma a alguien de su empresa.

    Solo contratista_admin: el mandante ya tiene su propio endpoint de invitación
    porque además define el alcance de aprobación por pilar, que del lado
    contratista no existe.
    """
    email = body.email.strip().lower()
    existente = db.query(Usuario).filter_by(email=email).first()
    if existente:
        # El mensaje distingue los dos casos porque la salida es distinta:
        # reenviar la invitación, o pedirle que recupere su clave.
        pista = ("Esa invitación sigue pendiente: puedes reenviarla."
                 if usuario_service.nunca_activo(existente)
                 else "Esa cuenta ya está activa.")
        raise HTTPException(status_code=400, detail=f"Ya existe un usuario con {email}. {pista}")

    try:
        usuario_service.exigir_rol_otorgable(actor, body.rol)
    except PermisoInsuficiente as e:
        raise HTTPException(status_code=403, detail=str(e))

    empresa = db.get(EmpresaContratista, actor.contratista_id)
    nuevo = Usuario(
        email=email, nombre=body.nombre.strip(), password_hash="",
        rol=body.rol, activo=False,
        contratista_id=actor.contratista_id,
        cargo=body.cargo or None,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    link = f"{settings.FRONTEND_URL}/activar?token={nuevo.id}"
    try:
        get_email_cliente().enviar(Email(
            destinatario=email,
            asunto=f"Invitación a Acredita — {empresa.razon_social if empresa else ''}",
            cuerpo_html=f"""
            <h2>Te invitaron a Acredita</h2>
            <p>{empresa.razon_social if empresa else 'Tu empresa'} te sumó para gestionar
            la documentación de acreditación.</p>
            <p>Para activar tu cuenta y definir tu contraseña:</p>
            <a href="{link}">Activar cuenta</a>
            <p>Este enlace es personal e intransferible.</p>
            """,
        ))
    except Exception:
        logger.exception("No se pudo enviar la invitación a %s", email)
        return {"mensaje": f"Usuario creado, pero el email a {email} no pudo enviarse.",
                "link_activacion": link}
    return {"mensaje": f"Invitación enviada a {email}"}


# ── Ciclo de vida de la cuenta ────────────────────────────────────────────────
#
# Las tres organizaciones —BERISA, mandante y contratista— usan los MISMOS
# endpoints. Quién puede tocar a quién lo decide usuario_service.puede_gestionar
# a partir de mandante_id / contratista_id, no la ruta: tener tres rutas
# paralelas garantizaba que la regla se separara en la tercera.

@router.patch("/{usuario_id}", response_model=UsuarioResponse)
def actualizar_usuario(
    usuario_id: uuid.UUID,
    body: ActualizarUsuarioRequest,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin"])),
):
    """
    Edita nombre, cargo, rol o estado de una cuenta de la propia organización.

    El email NO se puede cambiar: es la identidad con la que se activó la cuenta
    y con la que se resuelven las invitaciones. Cambiarlo dejaría enlaces de
    activación apuntando a una persona distinta.
    """
    objetivo = db.get(Usuario, usuario_id)
    if not objetivo:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    try:
        usuario_service.exigir_puede_gestionar(actor, objetivo)

        if body.nombre is not None:
            objetivo.nombre = body.nombre.strip()
        if body.cargo is not None:
            objetivo.cargo = body.cargo.strip() or None

        # Rol y activo son los dos cambios con consecuencias: pueden dejar a
        # alguien fuera o a una organización sin administrador.
        if body.rol is not None and body.rol != objetivo.rol:
            usuario_service.exigir_no_es_uno_mismo(actor, objetivo, "cambiar el rol de")
            usuario_service.exigir_rol_otorgable(actor, body.rol)
            usuario_service.exigir_no_es_ultimo_admin(db, objetivo)
            objetivo.rol = body.rol
        if body.activo is not None and body.activo != objetivo.activo:
            if not body.activo:
                usuario_service.exigir_no_es_uno_mismo(actor, objetivo, "desactivar")
                usuario_service.exigir_no_es_ultimo_admin(db, objetivo)
            elif usuario_service.nunca_activo(objetivo):
                # Reactivar a quien nunca definió contraseña lo dejaría "activo"
                # sin poder entrar, y peor: activo=True es lo que distingue una
                # invitación pendiente de una cuenta real en toda la UI.
                raise HTTPException(
                    status_code=400,
                    detail="Esta persona nunca activó su cuenta. Reenvíale la invitación.",
                )
            objetivo.activo = body.activo
    except PermisoInsuficiente as e:
        raise HTTPException(status_code=403, detail=str(e))

    db.commit()
    db.refresh(objetivo)
    return objetivo


@router.delete("/{usuario_id}", status_code=status.HTTP_200_OK)
def eliminar_usuario(
    usuario_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin"])),
):
    """
    Quita el acceso de una persona.

    DESACTIVA en vez de borrar. Un usuario que aprobó documentos está en
    AcreditacionEvento como el responsable de esa decisión, y borrarlo rompería
    la trazabilidad, que es lo único que este producto promete.

    ÚNICA excepción: una invitación que nunca se activó sí se borra de verdad.
    No tiene historial que preservar, y dejarla como fila inactiva bloquea el
    email para siempre — es exactamente lo que pasa hoy cuando alguien invita a
    una dirección mal tipeada y el reintento choca con "ya existe un usuario".
    """
    objetivo = db.get(Usuario, usuario_id)
    if not objetivo:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    try:
        usuario_service.exigir_puede_gestionar(actor, objetivo)
        usuario_service.exigir_no_es_uno_mismo(actor, objetivo, "eliminar")
        usuario_service.exigir_no_es_ultimo_admin(db, objetivo)
    except PermisoInsuficiente as e:
        raise HTTPException(status_code=403, detail=str(e))

    if usuario_service.nunca_activo(objetivo):
        email = objetivo.email
        db.query(UsuarioPilarPermiso).filter_by(usuario_id=objetivo.id).delete()
        db.delete(objetivo)
        db.commit()
        return {"mensaje": f"Invitación a {email} cancelada. El correo queda libre."}

    objetivo.activo = False
    db.commit()
    return {
        "mensaje": f"{objetivo.nombre} ya no tiene acceso. Su historial de "
                   "aprobaciones se conserva."
    }


@router.post("/{usuario_id}/reenviar-invitacion")
def reenviar_invitacion(
    usuario_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin"])),
):
    """
    Vuelve a mandar el correo de activación a quien todavía no entró.

    Sin esto, un correo que cayó en spam dejaba a la persona fuera sin salida: el
    link solo se devolvía en la rama de error del envío original y no se
    persistía en ninguna parte.
    """
    objetivo = db.get(Usuario, usuario_id)
    if not objetivo:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    try:
        usuario_service.exigir_puede_gestionar(actor, objetivo)
    except PermisoInsuficiente as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not usuario_service.nunca_activo(objetivo):
        raise HTTPException(
            status_code=400,
            detail="Esta cuenta ya está activa. Si perdió su contraseña, necesita recuperarla.",
        )

    link = f"{settings.FRONTEND_URL}/activar?token={objetivo.id}"
    try:
        get_email_cliente().enviar(Email(
            destinatario=objetivo.email,
            asunto="Tu invitación a Acredita",
            cuerpo_html=f"""
            <h2>Tu invitación sigue disponible</h2>
            <p>Para activar tu cuenta y definir tu contraseña:</p>
            <a href="{link}">Activar cuenta</a>
            <p>Este enlace es personal e intransferible.</p>
            """,
        ))
    except Exception:
        logger.exception("No se pudo reenviar la invitación a %s", objetivo.email)
        # El link vuelve solo en la respuesta autenticada de quien lo pidió, para
        # que pueda pasarlo por otro medio. Nunca se loguea.
        return {
            "mensaje": f"No se pudo enviar el correo a {objetivo.email}.",
            "link_activacion": link,
        }
    return {"mensaje": f"Invitación reenviada a {objetivo.email}"}
