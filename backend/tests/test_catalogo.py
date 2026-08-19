"""
Integridad del catalogo global de requisitos.

Existe por un bug real: `reglas_service` despacha los validadores POR CODIGO y
buscaba "EXAMEN_MEDICO", pero el requisito del catalogo se llama "EXAM_MED". La
funcion que comprueba aptitud y vigencia del examen ocupacional nunca se
ejecutaba, y el despacho FALLA ABIERTO —codigo desconocido devuelve
aprobado=True sin log ni excepcion—, asi que todo examen medico se aprobaba
solo, incluido uno que dijera NO APTO y estuviera vencido.

Ningun test lo agarro porque todos prueban el dominio con requisitos inventados,
no el catalogo real. Este cierra esa clase de error: cualquier codigo que el
codigo de produccion nombre tiene que existir de verdad.

Correr:  python tests/test_catalogo.py
"""
import importlib.util
import os
import sys
import tempfile
from collections import Counter

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_catalogo_")

from app.domain.estados import Alcance, EntidadTipo, NivelRequisito
from app.ia.schemas import SCHEMAS_POR_REQUISITO

_RUTA_SEED = os.path.join(os.path.dirname(__file__), "..", "scripts", "seed.py")
_spec = importlib.util.spec_from_file_location("seedmod", _RUTA_SEED)
seed = importlib.util.module_from_spec(_spec)
sys.modules["seedmod"] = seed
_spec.loader.exec_module(seed)


def run():
    CAT = seed.CATALOGO
    codigos = {r.codigo for r in CAT}

    # ── 1. Sin codigos repetidos ─────────────────────────────────────────────
    repes = [c for c, n in Counter(r.codigo for r in CAT).items() if n > 1]
    assert not repes, f"codigos duplicados en el catalogo: {repes}"
    print(f"PASS: {len(CAT)} requisitos, ningun codigo repetido")

    # ── 2. Todo subpilar referenciado existe ─────────────────────────────────
    subpilares = {s[0] for _, _, _, _, subs in seed.PILARES_CATALOGO for s in subs}
    huerfanos = [r.codigo for r in CAT if r.subpilar not in subpilares]
    assert not huerfanos, f"requisitos con subpilar inexistente: {huerfanos}"
    print(f"PASS: los {len(CAT)} requisitos cuelgan de un subpilar que existe")

    # ── 3. Enums validos ─────────────────────────────────────────────────────
    for r in CAT:
        assert r.entidad in set(EntidadTipo), f"{r.codigo}: entidad {r.entidad!r}"
        assert r.alcance in set(Alcance), f"{r.codigo}: alcance {r.alcance!r}"
        assert r.nivel in set(NivelRequisito), f"{r.codigo}: nivel {r.nivel!r}"
    print("PASS: entidad, alcance y nivel son valores validos del dominio")

    # ── 4. Los codigos que el CODIGO nombra tienen que existir ───────────────
    # Este es el que habria evitado el bug del examen medico.
    from app.domain import reglas_service
    import inspect
    fuente = inspect.getsource(reglas_service.validar_documento)
    # Los literales del dict de validadores
    import re
    despachados = set(re.findall(r'"([A-Z][A-Z0-9_]{2,})":\s*lambda', fuente))
    assert despachados, "no se pudo leer el dict de validadores; revisar el parseo"
    faltan = despachados - codigos
    assert not faltan, (
        f"reglas_service despacha validadores para codigos que NO estan en el "
        f"catalogo: {sorted(faltan)}. El despacho falla ABIERTO: el documento se "
        f"aprueba solo, sin log ni excepcion.")
    print(f"PASS: los {len(despachados)} validadores por codigo apuntan a requisitos reales")

    # ── 5. Lo mismo para los schemas de extraccion de la IA ──────────────────
    faltan_schema = set(SCHEMAS_POR_REQUISITO) - codigos
    assert not faltan_schema, (
        f"SCHEMAS_POR_REQUISITO declara codigos que no existen en el catalogo: "
        f"{sorted(faltan_schema)}. Cuando se encienda el pipeline, extraer_campos "
        f"violara su precondicion y la entrega quedara observada sin motivo util.")
    print(f"PASS: los {len(SCHEMAS_POR_REQUISITO)} schemas de extraccion apuntan a requisitos reales")

    # ── 6. Y para las plantillas de la demo ──────────────────────────────────
    for nombre, cods in seed.PLANTILLAS.items():
        faltan_pl = set(cods) - codigos
        assert not faltan_pl, (
            f"la plantilla {nombre} nombra codigos inexistentes: {sorted(faltan_pl)}. "
            f"El seed indexa CATALOGO_POR_CODIGO directo y falla al IMPORTARSE, "
            f"asi que el despliegue no carga ni el catalogo global.")
    print(f"PASS: las {len(seed.PLANTILLAS)} plantillas del seed solo nombran requisitos reales")

    # ── 7. Todo BASE cita la norma que lo respalda ──────────────────────────
    # No es cosmetico: BASE es lo que la app le AFIRMA al mandante sobre la ley
    # chilena —"esto lo exige la ley a todo empleador"— y una afirmacion sin
    # fundamento se convierte en una exigencia inventada a un contratista.
    #
    # Solo BASE, no AMPLIADO: el enum define AMPLIADO por su CONDICIONALIDAD
    # ("exigible solo bajo un supuesto"), no por su respaldo legal, y en el
    # catalogo hay tres marcados AMPLIADO cuya propia descripcion dice que son
    # practica de mercado —VIGENCIA_SOCIEDAD, VIGENCIA_PODERES y
    # POLIZA_TODO_RIESGO_OBRA—. Eso es una ambiguedad del modelo que conviene
    # resolver, pero no la resuelve un assert.
    sin_fundamento = [
        r.codigo for r in CAT
        if r.nivel == "BASE"
        and not any(t in r.desc for t in ("Fundamento", "art.", "Ley", "DS ", "DL ", "DFL"))
    ]
    assert not sin_fundamento, (
        f"requisitos declarados BASE sin norma citada en su descripcion: {sin_fundamento}. "
        f"BASE afirma que la ley chilena lo exige a todo empleador; si no hay norma, "
        f"el nivel correcto es OPCIONAL.")
    print(f"PASS: los {sum(1 for r in CAT if r.nivel == 'BASE')} requisitos BASE citan su norma")

    print("TODOS LOS TESTS DEL CATALOGO PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_catalogo():
    run()
