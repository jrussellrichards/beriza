class AcreditaError(Exception):
    """Base de todas las excepciones del dominio."""
    pass


class DocumentoNoEncontrado(AcreditaError):
    pass


class UsuarioNoEncontrado(AcreditaError):
    pass


class MandanteNoEncontrado(AcreditaError):
    pass


class ContratistaNoEncontrado(AcreditaError):
    pass


class TrabajadorNoEncontrado(AcreditaError):
    pass


class PermisoInsuficiente(AcreditaError):
    """El usuario no tiene el rol necesario para ejecutar esta acción."""
    pass


class ExcepcionExtraccion(AcreditaError):
    """
    El Vision LLM no pudo extraer uno o más campos requeridos del documento.
    Incluye el detalle de qué campos fallaron para generar un mensaje útil
    al contratista (ej: "El documento no es legible, suba una versión más clara").
    """
    def __init__(self, requisito_codigo: str, campos_fallidos: list[str]):
        self.requisito_codigo = requisito_codigo
        self.campos_fallidos = campos_fallidos
        super().__init__(f"No se pudo extraer {campos_fallidos} de {requisito_codigo}")


class EstadoDocumentoInvalido(AcreditaError):
    """
    Se intentó una transición de estado inválida.
    Ej: aprobar_por_excepcion sobre un documento ya aprobado.
    """
    pass


class RutInvalido(AcreditaError):
    """El RUT no cumple el formato o el dígito verificador es incorrecto."""
    pass


class ServicioNoEncontrado(AcreditaError):
    pass


class PerfilNoEncontrado(AcreditaError):
    pass


class AsignacionInvalida(AcreditaError):
    """
    Asignación incoherente entre entidades de distinto tenant.
    Ej: asignar a un servicio un trabajador de otra empresa, o
    asociar a un servicio un perfil de otro mandante.
    """
    pass


class EstadoServicioInvalido(AcreditaError):
    """Se intentó una transición de estado de servicio inválida."""
    pass


class ArchivoInvalido(AcreditaError):
    """La entrega de archivos no cumple la config del requisito (cantidad, formato, tamaño)."""
    pass


class EntregaInvalida(AcreditaError):
    """
    La entrega es incoherente con el catálogo o el estado del expediente.
    Ej: falta servicio_id para un requisito de alcance SERVICIO, o ya hay
    una entrega pendiente de revisión.
    """
    pass
