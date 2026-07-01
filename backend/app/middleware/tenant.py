from fastapi import Depends
from app.middleware.auth import get_usuario_actual


def get_mandante_id_from_token(usuario=Depends(get_usuario_actual)):
    """
    Extrae mandante_id del JWT del usuario autenticado.
    Solo válido para roles mandante_admin y prevencionista con contexto mandante.
    Lanza 403 si el usuario no pertenece a un mandante.
    """
    ...


def get_contratista_id_from_token(usuario=Depends(get_usuario_actual)):
    """
    Extrae contratista_id del JWT del usuario autenticado.
    Solo válido para roles contratista_admin y prevencionista con contexto contratista.
    Lanza 403 si el usuario no pertenece a una empresa contratista.
    """
    ...


def verificar_acceso_mandante(mandante_id_solicitado, usuario=Depends(get_usuario_actual)):
    """
    Verifica que el usuario tenga permiso para acceder a datos del mandante indicado.
    berisa_admin tiene acceso a cualquier mandante.
    mandante_admin solo puede acceder a su propio mandante_id.
    Lanza 403 si no hay acceso.
    """
    ...


def verificar_acceso_contratista(contratista_id_solicitado, usuario=Depends(get_usuario_actual)):
    """
    Verifica que el usuario tenga permiso para acceder a datos del contratista indicado.
    berisa_admin y mandante_admin tienen acceso si el contratista está vinculado a su mandante.
    contratista_admin solo puede acceder a su propia empresa.
    Lanza 403 si no hay acceso.
    """
    ...
