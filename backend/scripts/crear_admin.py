"""
Crea (o le cambia la clave a) un usuario berisa_admin.

Existe porque el seed dejo de crear `admin@berisa.cl / admin123` fuera de
desarrollo: una instalacion de produccion necesita un primer superadmin, y esa
clave la elige quien despliega, no este repositorio.

La clave NUNCA se imprime ni se pasa por linea de comandos. Se pide por stdin
sin eco (getpass), porque un argumento quedaria en el historial del shell y en
la lista de procesos de la maquina.

Uso normal, dentro del contenedor del backend:

    docker compose -f docker-compose.prod.yml exec backend \\
        python scripts/crear_admin.py tu.correo@empresa.cl

Si el usuario ya existe, se ofrece cambiarle la clave en vez de fallar: eso es
lo que hace falta cuando alguien se queda fuera.
"""
import getpass
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import Usuario

# Un superadmin administra el catalogo global y crea mandantes. La clave de
# demo que esto reemplaza tenia ocho caracteres adivinables.
LARGO_MINIMO = 12


def _leer(prompt: str, oculto: bool) -> str:
    """
    Lee una linea. Con terminal usa getpass (sin eco); sin terminal lee de
    stdin, para que el script se pueda automatizar.

    Sin esta distincion getpass se queda COLGADO cuando no hay tty —que es lo
    que pasa al canalizar la entrada— en vez de fallar o de leer lo que le
    mandan. Un script de bootstrap que se cuelga en silencio es peor que uno
    que no existe.
    """
    if oculto and sys.stdin.isatty():
        return getpass.getpass(prompt)
    print(prompt, end="", flush=True)
    linea = sys.stdin.readline()
    if not linea:
        print("\nERROR: no hay entrada. Ejecutalo con una terminal interactiva "
              "(docker compose exec, sin -T) o canalizale los datos.")
        sys.exit(1)
    return linea.rstrip("\n")


def _pedir_clave() -> str:
    clave = _leer("Clave para el administrador: ", oculto=True)
    if len(clave) < LARGO_MINIMO:
        print(f"ERROR: la clave debe tener al menos {LARGO_MINIMO} caracteres.")
        sys.exit(1)
    if clave != _leer("Repitela: ", oculto=True):
        print("ERROR: las claves no coinciden.")
        sys.exit(1)
    return clave


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    email = sys.argv[1].strip().lower()

    engine = create_engine(settings.DATABASE_URL)
    with Session(engine) as db:
        existente = db.query(Usuario).filter_by(email=email).first()

        if existente:
            print(f"Ya existe un usuario con {email} (rol: {existente.rol}).")
            if _leer("Cambiarle la clave? [s/N] ", oculto=False).strip().lower() not in ("s", "si", "si"):
                print("Sin cambios.")
                return
            existente.password_hash = hash_password(_pedir_clave())
            existente.activo = True
            db.commit()
            print(f"OK: clave actualizada para {email}.")
            return

        usuario = Usuario(
            email=email,
            nombre=_leer("Nombre para mostrar: ", oculto=False).strip() or "Administrador",
            password_hash=hash_password(_pedir_clave()),
            rol="berisa_admin",
            activo=True,
        )
        db.add(usuario)
        db.commit()
        print(f"OK: creado {email} como berisa_admin.")


if __name__ == "__main__":
    main()
