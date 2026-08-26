"""
Alta y edición de trabajadores.

Existe para que dar de alta a una persona de a una y hacerlo por nómina masiva
sigan las MISMAS reglas. Hasta ahora no era así: `nomina_service` validaba el
dígito verificador del RUT y el endpoint de a uno no, así que la misma fila se
aceptaba o se rechazaba según por dónde entrara.
"""
import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import AsignacionInvalida
from app.domain import rut_service
from app.models.trabajador import Trabajador

# Nadie trabaja con 14 años ni con 110. Los límites no son una regla laboral
# —esa depende de la faena— sino un filtro de tipeo: una fecha de nacimiento en
# 2020 es un año mal escrito, y guardarla en silencio deja a la persona
# permanentemente fuera de cualquier comprobación de edad.
EDAD_MINIMA_PLAUSIBLE = 15
EDAD_MAXIMA_PLAUSIBLE = 100


def _validar_fecha_nacimiento(f: date) -> None:
    hoy = date.today()
    if f > hoy:
        raise AsignacionInvalida("La fecha de nacimiento no puede estar en el futuro.")
    edad = hoy.year - f.year - ((hoy.month, hoy.day) < (f.month, f.day))
    if edad < EDAD_MINIMA_PLAUSIBLE:
        raise AsignacionInvalida(
            f"La fecha de nacimiento da {edad} años. Revisa el año: "
            f"por debajo de {EDAD_MINIMA_PLAUSIBLE} casi siempre es un error de tipeo."
        )
    if edad > EDAD_MAXIMA_PLAUSIBLE:
        raise AsignacionInvalida(
            f"La fecha de nacimiento da {edad} años. Revisa el año."
        )


def crear_trabajador(
    db: Session,
    empresa_id: uuid.UUID,
    rut: str,
    nombre_completo: str,
    cargo: str | None = None,
    fecha_nacimiento: date | None = None,
    email: str | None = None,
    telefono: str | None = None,
    direccion: str | None = None,
    contacto_emergencia_nombre: str | None = None,
    contacto_emergencia_telefono: str | None = None,
) -> Trabajador:
    """
    Da de alta a una persona en la empresa.

    Valida el RUT igual que la carga masiva. Antes no lo hacía, y eso permitía
    crear a alguien con el dígito verificador cambiado: los documentos quedan
    colgando de una persona que no existe, y el mandante no puede contrastar ese
    RUT contra el contrato ni contra el examen ocupacional.
    """
    nombre_completo = (nombre_completo or "").strip()
    if not nombre_completo:
        raise AsignacionInvalida("El trabajador necesita un nombre.")

    # RutInvalido sube tal cual: trae el motivo exacto, que es lo que hay que
    # mostrarle a quien esta tecleando.
    rut = rut_service.validar(rut)

    existente = db.query(Trabajador).filter_by(empresa_id=empresa_id, rut=rut).first()
    if existente:
        raise AsignacionInvalida(
            f"{existente.nombre_completo} ya está registrado con el RUT {rut}."
        )

    if fecha_nacimiento is not None:
        _validar_fecha_nacimiento(fecha_nacimiento)

    trabajador = Trabajador(
        empresa_id=empresa_id,
        rut=rut,
        nombre_completo=nombre_completo,
        cargo=(cargo or "").strip() or None,
        activo=True,
        fecha_nacimiento=fecha_nacimiento,
        email=(email or "").strip() or None,
        telefono=(telefono or "").strip() or None,
        direccion=(direccion or "").strip() or None,
        contacto_emergencia_nombre=(contacto_emergencia_nombre or "").strip() or None,
        contacto_emergencia_telefono=(contacto_emergencia_telefono or "").strip() or None,
    )
    db.add(trabajador)
    db.commit()
    db.refresh(trabajador)
    return trabajador


def actualizar_trabajador(
    db: Session,
    trabajador_id: uuid.UUID,
    empresa_id: uuid.UUID,
    nombre_completo: str | None = None,
    cargo: str | None = None,
    fecha_nacimiento: date | None = None,
    email: str | None = None,
    telefono: str | None = None,
    direccion: str | None = None,
    contacto_emergencia_nombre: str | None = None,
    contacto_emergencia_telefono: str | None = None,
) -> Trabajador:
    """
    Edición parcial: solo se pasan los campos a cambiar. Cadena vacía limpia.

    El RUT no se edita. Es la identidad de la persona dentro de la empresa y de
    ella cuelgan sus documentos; cambiarlo no corrige a un trabajador, se los
    transfiere a otro. Si está mal, se desactiva y se crea el correcto.

    `empresa_id` no es decorativo: sin comprobarlo, cualquier contratista_admin
    podría editar a un trabajador de otra empresa conociendo su id.
    """
    trabajador = db.get(Trabajador, trabajador_id)
    if not trabajador or trabajador.empresa_id != empresa_id:
        raise AsignacionInvalida("Ese trabajador no pertenece a tu empresa.")

    if nombre_completo is not None:
        nombre_completo = nombre_completo.strip()
        if not nombre_completo:
            raise AsignacionInvalida("El trabajador necesita un nombre.")
        trabajador.nombre_completo = nombre_completo

    if fecha_nacimiento is not None:
        _validar_fecha_nacimiento(fecha_nacimiento)
        trabajador.fecha_nacimiento = fecha_nacimiento

    for campo, valor in (
        ("cargo", cargo),
        ("email", email),
        ("telefono", telefono),
        ("direccion", direccion),
        ("contacto_emergencia_nombre", contacto_emergencia_nombre),
        ("contacto_emergencia_telefono", contacto_emergencia_telefono),
    ):
        if valor is not None:
            setattr(trabajador, campo, valor.strip() or None)

    db.commit()
    db.refresh(trabajador)
    return trabajador
