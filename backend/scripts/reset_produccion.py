"""
Deja la instalacion vacia y lista para el primer cliente real.

BORRA TODOS LOS DATOS. Es irreversible y no hay copia de seguridad automatica.
Se escribio para estrenar produccion despues de meses de demo, no es una
herramienta de mantenimiento: si algun dia hay clientes de verdad, esto no se
vuelve a ejecutar.

Que hace, en orden:

  1. Cuenta e IMPRIME lo que hay, tabla por tabla. Nada se borra antes de que
     se vea en pantalla que era lo que habia.
  2. Exige que se escriba la frase de confirmacion completa.
  3. Borra los archivos del storage (R2 o disco) de cada documento. Va primero
     que la base a proposito: despues de borrar las filas ya no se sabe que
     objetos habia que eliminar, y quedarian huerfanos pagando espacio.
  4. Vacia todas las tablas menos alembic_version, que es la que dice en que
     migracion esta el esquema.
  5. Recarga el catalogo global de pilares y requisitos, sin el cual la
     instalacion no puede operar.
  6. Crea el primer berisa_admin en estado invitado e imprime el ENLACE de
     activacion. La clave la elige quien abra ese enlace; este script no la
     conoce ni la pide.

Uso, dentro del contenedor del backend y con terminal interactiva:

    docker compose -f docker-compose.prod.yml exec backend \\
        python scripts/reset_produccion.py tu.correo@empresa.cl
"""
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.infrastructure.storage import get_storage
from app.models import Base, Usuario
from app.models.expediente import Archivo

FRASE = "BORRAR TODO"

# El esquema lo administra Alembic; vaciar esta tabla haria que la proxima
# migracion intentara correr desde cero sobre tablas que ya existen.
NO_TOCAR = {"alembic_version"}


def _inventario(db: Session) -> dict[str, int]:
    conteos = {}
    for tabla in Base.metadata.sorted_tables:
        if tabla.name in NO_TOCAR:
            continue
        conteos[tabla.name] = db.execute(
            text(f'SELECT count(*) FROM "{tabla.name}"')
        ).scalar_one()
    return conteos


def _borrar_archivos(db: Session) -> tuple[int, int]:
    """Borra del storage los objetos de cada Archivo. Devuelve (ok, fallidos)."""
    storage = get_storage()
    ok = fallidos = 0
    for (clave,) in db.query(Archivo.storage_key).all():
        if not clave:
            continue
        try:
            storage.eliminar(clave)
            ok += 1
        except Exception as e:
            # No se aborta: un objeto que ya no esta no debe impedir el reset.
            print(f"    aviso: no se pudo borrar {clave}: {e}")
            fallidos += 1
    return ok, fallidos


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    email = sys.argv[1].strip().lower()

    engine = create_engine(settings.DATABASE_URL)
    with Session(engine) as db:
        print(f"\n=== RESET DE {settings.ENVIRONMENT.upper()} ===\n")
        print("Esto es lo que hay ahora y se va a borrar:\n")
        conteos = _inventario(db)
        total = 0
        for tabla, n in sorted(conteos.items(), key=lambda kv: -kv[1]):
            if n:
                print(f"  {n:>6}  {tabla}")
                total += n
        if not total:
            print("  (la base ya está vacía)")
        print(f"\n  TOTAL: {total} filas, en {sum(1 for n in conteos.values() if n)} tablas.")
        print(f"  Storage: {settings.FILE_STORAGE}")
        print("\nEsto NO se puede deshacer y no hay copia de seguridad.")

        respuesta = input(f'\nEscribe "{FRASE}" para continuar: ').strip()
        if respuesta != FRASE:
            print("Cancelado, no se tocó nada.")
            sys.exit(1)

        print("\n1/4 Borrando archivos del storage...")
        ok, fallidos = _borrar_archivos(db)
        print(f"    {ok} borrados, {fallidos} con problema.")

        print("2/4 Vaciando tablas...")
        # En orden inverso a las dependencias, para no pelear con las FK.
        for tabla in reversed(Base.metadata.sorted_tables):
            if tabla.name in NO_TOCAR:
                continue
            db.execute(text(f'DELETE FROM "{tabla.name}"'))
        db.commit()
        restantes = sum(_inventario(db).values())
        assert restantes == 0, f"quedaron {restantes} filas sin borrar"
        print("    0 filas en todas las tablas.")

    print("3/4 Recargando el catálogo global...")
    from scripts.seed import seed_pilares  # noqa: import tardío, necesita el path
    with Session(engine) as db:
        seed_pilares(db)
        db.commit()

    print("4/4 Creando el primer administrador...")
    with Session(engine) as db:
        usuario = Usuario(
            email=email,
            nombre="Administrador BERISA",
            # Placeholder invalido a proposito: el bcrypt de la activacion lo
            # reemplaza y mientras tanto ningun login puede coincidir con esto.
            password_hash="",
            rol="berisa_admin",
            activo=False,   # invitado: se activa al elegir la clave
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        token = str(usuario.id)

    base = os.getenv("APP_URL", "").rstrip("/") or "https://beriza.vercel.app"
    print("\n=== LISTO ===\n")
    print(f"  Abre este enlace para elegir la clave de {email}:\n")
    print(f"    {base}/activar?token={token}\n")
    print("  Es de un solo uso: al activarse deja de servir.")
    print("  Si se pierde, vuelve a correr scripts/crear_admin.py.\n")


if __name__ == "__main__":
    main()
