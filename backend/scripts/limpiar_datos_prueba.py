"""
Borra de la base los datos de prueba que se crearon a mano durante el desarrollo.

Es DESTRUCTIVO e irreversible, así que:

- Los objetivos van en listas EXPLÍCITAS por RUT y por código, nunca por
  heurística ("nombres raros", "RUT corto"). Una heurística que se equivoca acá
  borra una empresa real con sus certificados.
- Por defecto hace un SIMULACRO: enumera lo que borraría y no toca nada. Para
  ejecutar de verdad hay que pasar --ejecutar.
- El orden respeta las llaves foráneas, de la hoja a la raíz.
- Los archivos en R2 se borran también: dejar los objetos huérfanos significa
  seguir pagando por documentos de empresas que ya no existen, y ademas son
  datos personales de trabajadores (Ley 19.628) que no corresponde retener.

Uso:
    python scripts/limpiar_datos_prueba.py              # simulacro
    python scripts/limpiar_datos_prueba.py --ejecutar   # borra
"""
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain import rut_service
from app.infrastructure.storage import get_storage
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, AcreditacionEvento, Archivo, Entrega, Expediente
from app.models.permiso import UsuarioPilarPermiso
from app.models.pilar import RequisitoDocumental
from app.models.servicio import PerfilRequisitoConfig, Servicio, ServicioTrabajador
from app.models.trabajador import Trabajador
from app.models.usuario import Usuario

# ── Objetivos, aprobados uno por uno ─────────────────────────────────────────

# Contratistas creados a mano para probar. Se identifican por el CUERPO del RUT
# —el número sin dígito verificador— y no por el RUT completo.
#
# La razón es concreta y casi cuesta caro: `rut_service.normalizar_en_tabla`
# corrige el dígito de los RUT guardados, así que "7777777-2" ya es "7.777.777-6"
# en producción. Una lista con el valor viejo no lo habría encontrado y el script
# habría borrado 5 de 7 contratistas EN SILENCIO, informando éxito.
#
# El cuerpo es la invariante: la normalización nunca lo toca. El nombre no sirve
# como clave porque "javier nicolas italo" se repite tres veces.
CUERPOS_CONTRATISTAS = [
    "18623018", "1281818", "32132",   # javier nicolas italo
    "7777777",                        # don pedrito
    "12",                             # san jose      (RUT "123")
    "1234",                           # italonico     (RUT "12345")
    "12312312",                       # contratista   (RUT "123123123")
]


def _cuerpo(rut: str) -> str:
    """Número del RUT sin el dígito verificador, sin puntos ni guion."""
    return rut_service.clave(rut)[:-1]

# Servicios inventados a mano sobre contratistas legítimos: hay que borrarlos
# aparte porque su empresa se conserva.
CODIGOS_SERVICIOS = ["asd123", "123-12"]

# Requisito de prueba en el catálogo GLOBAL: lo ven todos los mandantes.
CODIGOS_REQUISITOS = ["CERTIFICACION_2"]

# Invitaciones de prueba que quedaron pendientes.
EMAILS_USUARIOS = [
    "doñacarmen@gmail.com",
    "dasads@gmail.com",
    "prueba.verificacion@example.com",
]

# Trabajadores creados al verificar la carga masiva.
RUTS_TRABAJADORES = ["9.437.019-1"]


class Borrador:
    """Acumula lo que se va a borrar y lo aplica solo si se pidió ejecutar."""

    def __init__(self, db: Session, ejecutar: bool):
        self.db = db
        self.ejecutar = ejecutar
        self.conteos: dict[str, int] = {}
        self.storage_keys: list[str] = []

    def borrar(self, modelo, ids: list, etiqueta: str):
        if not ids:
            return
        self.conteos[etiqueta] = self.conteos.get(etiqueta, 0) + len(ids)
        if self.ejecutar:
            self.db.query(modelo).filter(modelo.id.in_(ids)).delete(synchronize_session=False)

    def resumen(self):
        for etiqueta, n in self.conteos.items():
            print(f"    {n:4}  {etiqueta}")


def _ids(rows) -> list:
    return [r[0] for r in rows]


def _borrar_expedientes(b: Borrador, expediente_ids: list):
    """Expediente → Entrega → Archivo, y Acreditacion → AcreditacionEvento."""
    if not expediente_ids:
        return
    db = b.db
    acred_ids = _ids(db.query(Acreditacion.id).filter(
        Acreditacion.expediente_id.in_(expediente_ids)).all())
    entrega_ids = _ids(db.query(Entrega.id).filter(
        Entrega.expediente_id.in_(expediente_ids)).all())

    if entrega_ids:
        archivos = db.query(Archivo).filter(Archivo.entrega_id.in_(entrega_ids)).all()
        b.storage_keys.extend(a.storage_key for a in archivos)
        b.borrar(Archivo, [a.id for a in archivos], "archivos")

    if acred_ids:
        b.borrar(AcreditacionEvento, _ids(db.query(AcreditacionEvento.id).filter(
            AcreditacionEvento.acreditacion_id.in_(acred_ids)).all()), "eventos de bitácora")
        # La acreditación referencia la entrega: se va antes que ella.
        b.borrar(Acreditacion, acred_ids, "acreditaciones")

    b.borrar(Entrega, entrega_ids, "entregas")
    b.borrar(Expediente, expediente_ids, "expedientes")


def _borrar_servicios(b: Borrador, servicio_ids: list):
    if not servicio_ids:
        return
    db = b.db
    # Un expediente de alcance SERVICIO cuelga del servicio.
    _borrar_expedientes(b, _ids(db.query(Expediente.id).filter(
        Expediente.servicio_id.in_(servicio_ids)).all()))
    b.borrar(ServicioTrabajador, _ids(db.query(ServicioTrabajador.id).filter(
        ServicioTrabajador.servicio_id.in_(servicio_ids)).all()), "asignaciones a servicios")
    b.borrar(Servicio, servicio_ids, "servicios")


def _borrar_usuarios(b: Borrador, usuario_ids: list):
    if not usuario_ids:
        return
    b.borrar(UsuarioPilarPermiso, _ids(b.db.query(UsuarioPilarPermiso.id).filter(
        UsuarioPilarPermiso.usuario_id.in_(usuario_ids)).all()), "permisos por pilar")
    b.borrar(Usuario, usuario_ids, "usuarios")


def limpiar(db: Session, ejecutar: bool) -> Borrador:
    b = Borrador(db, ejecutar)

    # ── 1. Contratistas de prueba, con todo lo que cuelga de ellos ────────────
    # Se filtra en Python y no en SQL porque la comparación es por cuerpo del
    # RUT, que la base guarda con puntos y guion en formatos inconsistentes.
    objetivo = set(CUERPOS_CONTRATISTAS)
    empresas = [e for e in db.query(EmpresaContratista).all() if _cuerpo(e.rut) in objetivo]

    encontrados = {_cuerpo(e.rut) for e in empresas}
    faltantes = objetivo - encontrados
    if faltantes and empresas:
        # Avisar en vez de callar: si la lista apunta a algo que ya no está, hay
        # que saberlo antes de dar la limpieza por completa.
        print(f"\n  AVISO: {len(faltantes)} contratista(s) de la lista no están en la base: "
              f"{', '.join(sorted(faltantes))}")

    if empresas:
        print("\n  Contratistas:")
        for e in empresas:
            print(f"    - {e.razon_social}  ({e.rut})")
        empresa_ids = [e.id for e in empresas]

        relaciones = _ids(db.query(ContratistaMandante.id).filter(
            ContratistaMandante.contratista_id.in_(empresa_ids)).all())
        if relaciones:
            _borrar_servicios(b, _ids(db.query(Servicio.id).filter(
                Servicio.contratista_mandante_id.in_(relaciones)).all()))

        trabajadores = _ids(db.query(Trabajador.id).filter(
            Trabajador.empresa_id.in_(empresa_ids)).all())
        if trabajadores:
            b.borrar(ServicioTrabajador, _ids(db.query(ServicioTrabajador.id).filter(
                ServicioTrabajador.trabajador_id.in_(trabajadores)).all()), "asignaciones a servicios")
            _borrar_expedientes(b, _ids(db.query(Expediente.id).filter(
                Expediente.trabajador_id.in_(trabajadores)).all()))

        _borrar_expedientes(b, _ids(db.query(Expediente.id).filter(
            Expediente.empresa_id.in_(empresa_ids)).all()))
        b.borrar(Trabajador, trabajadores, "trabajadores")
        _borrar_usuarios(b, _ids(db.query(Usuario.id).filter(
            Usuario.contratista_id.in_(empresa_ids)).all()))
        b.borrar(ContratistaMandante, relaciones, "relaciones contratista-mandante")
        b.borrar(EmpresaContratista, empresa_ids, "contratistas")

    # ── 2. Servicios sueltos hechos a mano ────────────────────────────────────
    servicios = db.query(Servicio).filter(
        Servicio.codigo_referencia.in_(CODIGOS_SERVICIOS)).all()
    if servicios:
        print("\n  Servicios:")
        for s in servicios:
            print(f"    - {s.nombre}  (código {s.codigo_referencia})")
        _borrar_servicios(b, [s.id for s in servicios])

    # ── 3. Requisitos de prueba del catálogo global ───────────────────────────
    requisitos = db.query(RequisitoDocumental).filter(
        RequisitoDocumental.codigo.in_(CODIGOS_REQUISITOS)).all()
    if requisitos:
        print("\n  Requisitos del catálogo:")
        for r in requisitos:
            print(f"    - {r.codigo}  «{r.nombre}»")
        req_ids = [r.id for r in requisitos]
        _borrar_expedientes(b, _ids(db.query(Expediente.id).filter(
            Expediente.requisito_id.in_(req_ids)).all()))
        b.borrar(PerfilRequisitoConfig, _ids(db.query(PerfilRequisitoConfig.id).filter(
            PerfilRequisitoConfig.requisito_documental_id.in_(req_ids)).all()),
            "configuraciones de perfil")
        b.borrar(RequisitoDocumental, req_ids, "requisitos del catálogo")

    # ── 4. Usuarios de prueba ─────────────────────────────────────────────────
    usuarios = db.query(Usuario).filter(Usuario.email.in_(EMAILS_USUARIOS)).all()
    if usuarios:
        print("\n  Usuarios:")
        for u in usuarios:
            print(f"    - {u.email}  ({'activo' if u.activo else 'invitación pendiente'})")
        _borrar_usuarios(b, [u.id for u in usuarios])

    # ── 5. Trabajadores de prueba ─────────────────────────────────────────────
    trabs = db.query(Trabajador).filter(Trabajador.rut.in_(RUTS_TRABAJADORES)).all()
    if trabs:
        print("\n  Trabajadores:")
        for t in trabs:
            print(f"    - {t.nombre_completo}  ({t.rut})")
        t_ids = [t.id for t in trabs]
        b.borrar(ServicioTrabajador, _ids(db.query(ServicioTrabajador.id).filter(
            ServicioTrabajador.trabajador_id.in_(t_ids)).all()), "asignaciones a servicios")
        _borrar_expedientes(b, _ids(db.query(Expediente.id).filter(
            Expediente.trabajador_id.in_(t_ids)).all()))
        b.borrar(Trabajador, t_ids, "trabajadores")

    return b


def corregir_ruts(db: Session, ejecutar: bool) -> int:
    """Corrige el dígito verificador. La lógica vive en el dominio porque el
    seed hace lo mismo antes de buscar por RUT (ver `_normalizar_ruts`)."""
    cambios = (rut_service.normalizar_en_tabla(db, EmpresaContratista, aplicar=ejecutar)
               + rut_service.normalizar_en_tabla(db, Trabajador, aplicar=ejecutar))
    for nombre, viejo, nuevo in cambios:
        print(f"    {nombre[:38]:38} {viejo:16} -> {nuevo}")
    return len(cambios)


def main():
    ejecutar = "--ejecutar" in sys.argv
    print("=" * 74)
    print("  LIMPIEZA DE DATOS DE PRUEBA" + ("" if ejecutar else "   [SIMULACRO — no se borra nada]"))
    print("=" * 74)

    engine = create_engine(settings.DATABASE_URL)
    db = Session(engine)

    b = limpiar(db, ejecutar)

    print("\n  RUT con dígito verificador inválido:")
    n_ruts = corregir_ruts(db, ejecutar)
    if n_ruts == 0:
        print("    (ninguno)")

    print("\n  Filas afectadas:")
    if b.conteos:
        b.resumen()
    else:
        print("    (ninguna — ya estaba limpio)")

    if ejecutar:
        db.commit()
        # Los objetos de R2 se borran DESPUÉS del commit: si falla el borrado en
        # la nube quedan huérfanos, pero si se borraran antes y fallara el commit
        # tendríamos filas apuntando a archivos que ya no existen, que es peor.
        if b.storage_keys:
            storage = get_storage()
            fallidos = 0
            for key in b.storage_keys:
                try:
                    storage.eliminar(key)
                except Exception:
                    fallidos += 1
            print(f"\n  Archivos borrados del storage: {len(b.storage_keys) - fallidos}"
                  f"{f' ({fallidos} fallaron)' if fallidos else ''}")
        print(f"\n  LISTO. {n_ruts} RUT corregidos.")
    else:
        print(f"\n  Archivos que se borrarían del storage: {len(b.storage_keys)}")
        print("\n  Simulacro. Para aplicarlo: python scripts/limpiar_datos_prueba.py --ejecutar")

    db.close()


if __name__ == "__main__":
    main()
