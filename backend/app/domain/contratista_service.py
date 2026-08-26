"""
Datos propios de la empresa contratista.

Lo que vive acá es la edición de la ficha de la empresa: mutualidad, dirección,
teléfono de emergencia y representante legal. Son los datos que el mandante
necesita tener a mano en una fiscalización y que hasta ahora no existían — la
empresa se daba de alta con RUT, razón social y giro, y nada más.
"""
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AsignacionInvalida
from app.domain import rut_service
from app.domain.estados import Mutualidad
from app.models.contratista import EmpresaContratista


def actualizar_empresa(
    db: Session,
    empresa_id: uuid.UUID,
    razon_social: str | None = None,
    giro: str | None = None,
    mutualidad: str | None = None,
    direccion: str | None = None,
    telefono_emergencia: str | None = None,
    representante_legal_nombre: str | None = None,
    representante_legal_rut: str | None = None,
    representante_legal_telefono: str | None = None,
) -> EmpresaContratista:
    """
    Edición parcial de la ficha: solo se pasan los campos a cambiar, el resto
    queda como está. Mandar cadena vacía SÍ limpia el campo — es la única forma
    de corregir un dato mal cargado, y estos son opcionales.

    El RUT de la empresa no se edita a propósito: es único en la plataforma y es
    la llave con la que el contratista existe frente a TODOS sus mandantes.
    Cambiarlo no es corregir una empresa, es convertirla en otra.
    """
    empresa = db.get(EmpresaContratista, empresa_id)
    if not empresa:
        raise AsignacionInvalida("La empresa contratista no existe.")

    if razon_social is not None:
        razon_social = razon_social.strip()
        if not razon_social:
            raise AsignacionInvalida("La empresa necesita una razón social.")
        empresa.razon_social = razon_social

    if mutualidad is not None:
        mutualidad = mutualidad.strip().upper()
        if mutualidad and mutualidad not in set(Mutualidad):
            # Con el nombre libre, "ACHS" y "Asociación Chilena de Seguridad"
            # serían dos organismos distintos. Se rechaza en vez de guardar algo
            # que después no se puede ni filtrar ni reportar.
            validas = ", ".join(m.value for m in Mutualidad)
            raise AsignacionInvalida(
                f"Mutualidad «{mutualidad}» desconocida. Las válidas son: {validas}."
            )
        empresa.mutualidad = mutualidad or None

    if representante_legal_rut is not None:
        rut = representante_legal_rut.strip()
        if rut:
            # El dígito verificador se valida por la misma razón que en la
            # nómina: detecta el dígito cambiado de lugar, que es el error
            # típico de transcribir a mano. Un representante con RUT malo no
            # sirve para contrastar contra el certificado de vigencia de poderes,
            # que es justamente para lo que se guarda.
            #
            # RutInvalido sube tal cual: trae el motivo exacto —"el dígito
            # verificador debería terminar en 4"— y eso es lo que hay que
            # mostrar. Traducirlo a "RUT inválido" obliga a adivinar.
            rut = rut_service.validar(rut)
        empresa.representante_legal_rut = rut or None

    if giro is not None:
        empresa.giro = giro.strip() or None
    if direccion is not None:
        empresa.direccion = direccion.strip() or None
    if telefono_emergencia is not None:
        empresa.telefono_emergencia = telefono_emergencia.strip() or None
    if representante_legal_nombre is not None:
        empresa.representante_legal_nombre = representante_legal_nombre.strip() or None
    if representante_legal_telefono is not None:
        empresa.representante_legal_telefono = representante_legal_telefono.strip() or None

    db.commit()
    db.refresh(empresa)
    return empresa
