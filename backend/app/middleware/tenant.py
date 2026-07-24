"""
Verificación de pertenencia de tenant — autorización a nivel de DATO.

`middleware/auth.py::require_rol` valida QUÉ rol tiene el usuario, pero no QUÉ
registros puede tocar. Estas funciones cierran ese segundo control: que un
mandante solo acceda a lo suyo y un contratista solo a lo de su empresa.

berisa_admin tiene acceso transversal por diseño (superadmin). El resto se
acota por el mandante_id / contratista_id que el usuario trae en el JWT.

Contexto: ver docs/rediseno-modelo-documentos.md (Fase 0). Antes de esto los
endpoints de documentos/acreditación solo verificaban rol; la duplicación
física por mandante enmascaraba el gap, pero al compartir archivos entre
mandantes (Fase 1) esa máscara desaparece.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.contratista import ContratistaMandante
from app.models.documento import Documento
from app.models.trabajador import Trabajador
from app.models.usuario import Usuario


def _empresa_duena_de(db: Session, documento: Documento) -> uuid.UUID | None:
    """Empresa contratista dueña del documento (directa, o vía su trabajador)."""
    if documento.empresa_id:
        return documento.empresa_id
    if documento.trabajador_id:
        trabajador = db.get(Trabajador, documento.trabajador_id)
        return trabajador.empresa_id if trabajador else None
    return None


def verificar_acceso_documento(db: Session, documento: Documento, usuario: Usuario) -> None:
    """
    Autoriza a ver/descargar un documento. Acceso permitido a:
      - berisa_admin (transversal),
      - el mandante que lo exige (documento.mandante_id),
      - la empresa contratista dueña del expediente.
    Lanza 403 en cualquier otro caso.
    """
    if usuario.rol == "berisa_admin":
        return
    if usuario.mandante_id and documento.mandante_id == usuario.mandante_id:
        return
    if usuario.contratista_id and _empresa_duena_de(db, documento) == usuario.contratista_id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tiene acceso a este documento",
    )


def verificar_acceso_relacion(
    db: Session,
    contratista_id: uuid.UUID,
    mandante_id: uuid.UUID,
    usuario: Usuario,
) -> None:
    """
    Autoriza a consultar la acreditación de una relación contratista↔mandante.
    berisa_admin: transversal. Un mandante solo puede consultar su propio
    mandante_id; un contratista solo su propio contratista_id.
    """
    if usuario.rol == "berisa_admin":
        return
    if usuario.mandante_id:
        if usuario.mandante_id != mandante_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene acceso a este mandante")
        return
    if usuario.contratista_id:
        if usuario.contratista_id != contratista_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene acceso a este contratista")
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario sin contexto de acceso")


def verificar_puede_subir_para(
    db: Session,
    usuario: Usuario,
    mandante_id: uuid.UUID,
    empresa_id: uuid.UUID | None,
    trabajador_id: uuid.UUID | None,
) -> None:
    """
    Valida que el contratista autenticado suba documentos SOLO para su propia
    empresa/trabajadores, y ante un mandante realmente vinculado a él. Evita que
    un contratista escriba sobre el expediente de otra empresa o declare un
    mandante con el que no tiene relación.
    """
    if not usuario.contratista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario sin contexto de contratista")

    empresa_objetivo = empresa_id
    if empresa_objetivo is None and trabajador_id:
        trabajador = db.get(Trabajador, trabajador_id)
        empresa_objetivo = trabajador.empresa_id if trabajador else None
    if empresa_objetivo != usuario.contratista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puede subir documentos para otra empresa")

    vinculado = db.query(ContratistaMandante).filter_by(
        contratista_id=usuario.contratista_id, mandante_id=mandante_id
    ).first()
    if not vinculado:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No está vinculado a ese mandante")
