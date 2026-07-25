"""
Smoke test de la carga masiva de nomina, contra SQLite.

Lo que importa verificar no es que cargue un archivo bueno —eso es lo facil—
sino como se comporta con un archivo REAL: filas malas mezcladas con buenas,
acentos guardados por Excel en cp1252, punto y coma como separador, columnas
reordenadas y el mismo archivo subido dos veces.

Correr:  python tests/test_nomina.py
"""
import io
import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_nomina_")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.core.exceptions import RutInvalido
from app.models.base import Base
from app.models.contratista import EmpresaContratista
from app.models.trabajador import Trabajador
from app.domain import nomina_service, rut_service


def _csv(texto: str, encoding: str = "utf-8") -> bytes:
    return texto.encode(encoding)


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = Session(eng)

    empresa = EmpresaContratista(rut="76.111.222-3", razon_social="Constructora Condor SpA")
    db.add(empresa); db.commit()

    # ── 1. El digito verificador ──────────────────────────────────────────────
    # Es la razon de ser del validador: detecta el dígito mal transcrito, que es
    # el error tipico de copiar 80 RUT a mano.
    assert rut_service.validar("17555666-4") == "17.555.666-4", "debe normalizar el formato"
    assert rut_service.validar("17.555.666-4") == "17.555.666-4"
    for malo, porque in [
        ("17.555.666-9", "digito verificador incorrecto"),
        ("asdasd", "no es un RUT"),
        ("", "vacio"),
        ("123-5", "demasiado corto"),
    ]:
        try:
            rut_service.validar(malo)
            raise AssertionError(f"acepto un RUT invalido: {malo!r} ({porque})")
        except RutInvalido:
            pass
    # La K va en mayuscula y valida igual escrita en minuscula.
    assert rut_service.validar("20.666.777-k") == "20.666.777-K"
    print("PASS: el digito verificador se valida y el RUT se normaliza")

    # Dos formatos del mismo RUT deben ser la MISMA clave, si no el dedup falla.
    assert rut_service.clave("17.555.666-4") == rut_service.clave("17555666-4")
    print("PASS: la clave canonica ignora puntos y guion")

    # ── 2. Importacion parcial: buenas y malas en el mismo archivo ────────────
    archivo = _csv(
        "RUT;Nombre completo;Cargo\r\n"
        "17.555.666-4;Maria Soto Vargas;Prevencionista\r\n"
        "19.444.555-5;Pedro Gonzalez Rojas;Jefe de Obra\r\n"
        "12.345.678-9;Juan Malo Perez;Operador\r\n"      # dv incorrecto
        "20.666.777-K;;Operador\r\n"                      # sin nombre
        "no-es-rut;Otro Malo;Ayudante\r\n"                # basura
    )
    r = nomina_service.importar_nomina(db, empresa.id, archivo, "nomina.csv")
    assert r.filas_leidas == 5, f"debio leer 5 filas, leyo {r.filas_leidas}"
    assert r.cargados == 2, f"debio cargar 2, cargo {r.cargados}"
    assert r.con_error == 3, f"debio reportar 3 errores, reporto {r.con_error}"
    assert r.cargados + r.ya_existian + r.con_error == r.filas_leidas, \
        "las categorias del reporte deben sumar las filas leidas"
    # El error nombra la FILA y el motivo: decir "hay un error" sin decir donde
    # obliga a revisar 80 lineas a mano.
    filas_malas = {e.fila for e in r.errores}
    assert filas_malas == {4, 5, 6}, f"las filas malas son la 4, 5 y 6: {filas_malas}"
    assert any("verificador" in e.motivo for e in r.errores), \
        f"debe explicar el digito verificador: {[e.motivo for e in r.errores]}"
    assert any("nombre" in e.motivo.lower() for e in r.errores)
    assert db.query(Trabajador).count() == 2, "solo deben existir los dos validos"
    print("PASS: importacion parcial — carga las buenas y reporta las malas con fila y motivo")

    # ── 3. Volver a subir el MISMO archivo no duplica ─────────────────────────
    # Es el caso normal: se corrigen tres filas y se sube de nuevo.
    r2 = nomina_service.importar_nomina(db, empresa.id, archivo, "nomina.csv")
    assert r2.cargados == 0, f"no debio cargar nada nuevo, cargo {r2.cargados}"
    assert r2.ya_existian == 2, f"debio reconocer 2 existentes, reconocio {r2.ya_existian}"
    assert db.query(Trabajador).count() == 2, "no se debe duplicar a nadie"
    print("PASS: resubir el mismo archivo no duplica trabajadores")

    # Y tampoco duplica si el RUT viene con otro formato.
    otro_formato = _csv("RUT;Nombre completo;Cargo\r\n17555666-4;Maria Soto Vargas;Prevencionista\r\n")
    r3 = nomina_service.importar_nomina(db, empresa.id, otro_formato, "n.csv")
    assert r3.ya_existian == 1 and r3.cargados == 0, \
        "el mismo RUT sin puntos debe reconocerse como existente"
    assert db.query(Trabajador).count() == 2
    print("PASS: el dedup no depende del formato del RUT")

    # ── 4. Duplicado DENTRO del archivo ───────────────────────────────────────
    dup = _csv(
        "RUT;Nombre completo;Cargo\r\n"
        "13.185.531-1;Ana Perez;Operaria\r\n"
        "13185531-1;Ana Perez Repetida;Operaria\r\n"
    )
    r4 = nomina_service.importar_nomina(db, empresa.id, dup, "dup.csv")
    assert r4.cargados == 1, f"solo una vez, cargo {r4.cargados}"
    assert any("repetido" in e.motivo.lower() for e in r4.errores), \
        f"debe avisar del repetido: {[e.motivo for e in r4.errores]}"
    print("PASS: detecta RUT repetido dentro del mismo archivo")

    # ── 5. Excel guarda en cp1252: los acentos no deben romper la carga ───────
    acentos = "RUT;Nombre completo;Cargo\r\n9.437.019-1;José Muñoz Peña;Capataz\r\n".encode("cp1252")
    r5 = nomina_service.importar_nomina(db, empresa.id, acentos, "acentos.csv")
    assert r5.cargados == 1, f"debio cargar el de acentos: {[e.motivo for e in r5.errores]}"
    guardado = db.query(Trabajador).filter_by(rut="9.437.019-1").first()
    assert guardado.nombre_completo == "José Muñoz Peña", \
        f"los acentos se guardaron mal: {guardado.nombre_completo!r}"
    print("PASS: lee CSV en cp1252 (Excel Windows) sin romper acentos")

    # ── 6. Columnas reordenadas: se leen por NOMBRE, no por posicion ──────────
    # Si se leyera por indice, aca los nombres entrarian en el campo RUT.
    reordenado = _csv("Cargo,Nombre completo,RUT\r\nSoldador,Carlos Diaz,7.891.234-0\r\n")
    r6 = nomina_service.importar_nomina(db, empresa.id, reordenado, "orden.csv")
    assert r6.cargados == 1, f"debio cargar con columnas invertidas: {[e.motivo for e in r6.errores]}"
    carlos = db.query(Trabajador).filter_by(rut="7.891.234-0").first()
    assert carlos and carlos.nombre_completo == "Carlos Diaz", "leyo las columnas por posicion"
    print("PASS: encuentra las columnas por nombre aunque esten reordenadas")

    # ── 7. Coma como separador (Excel en ingles) ──────────────────────────────
    assert r6.cargados == 1, "el archivo anterior usaba coma y funciono"
    print("PASS: soporta coma y punto y coma como separador")

    # ── 8. Archivos que no se pueden procesar: error del ARCHIVO, no por fila ─
    for contenido, nombre, porque in [
        (_csv("Columna A;Columna B\r\n1;2\r\n"), "malo.csv", "sin columnas RUT/Nombre"),
        (_csv(""), "vacio.csv", "vacio"),
        (_csv("RUT;Nombre completo\r\n"), "solo-encabezado.pdf", "formato no soportado"),
    ]:
        try:
            nomina_service.importar_nomina(db, empresa.id, contenido, nombre)
            raise AssertionError(f"acepto un archivo que no debia: {porque}")
        except ValueError:
            pass
    print("PASS: rechaza archivos sin columnas, vacios o de formato no soportado")

    # ── 9. Aislamiento entre empresas ─────────────────────────────────────────
    # El mismo RUT en OTRA empresa es otro trabajador: una persona puede estar
    # contratada por dos contratistas distintos.
    otra = EmpresaContratista(rut="77.333.444-5", razon_social="Otra SpA")
    db.add(otra); db.commit()
    r7 = nomina_service.importar_nomina(
        db, otra.id, _csv("RUT;Nombre completo\r\n17.555.666-4;Maria Soto Vargas\r\n"), "n.csv")
    assert r7.cargados == 1, "el mismo RUT en otra empresa debe poder cargarse"
    assert db.query(Trabajador).filter_by(empresa_id=otra.id).count() == 1
    assert db.query(Trabajador).filter_by(empresa_id=empresa.id).count() == 5, \
        "no debe haberse tocado la nomina de la primera empresa"
    print("PASS: el dedup es por empresa, no global")

    # ── 10. La plantilla que entregamos debe pasar su propia validacion ───────
    # Si la plantilla trae ejemplos invalidos, el primer intento de todos falla
    # contra el archivo que les dimos nosotros.
    tercera = EmpresaContratista(rut="78.555.666-7", razon_social="Tercera SpA")
    db.add(tercera); db.commit()
    r8 = nomina_service.importar_nomina(db, tercera.id, nomina_service.plantilla_csv(), "plantilla.csv")
    assert r8.con_error == 0, \
        f"la plantilla propia no valida: {[(e.fila, e.motivo) for e in r8.errores]}"
    assert r8.cargados == 3, f"la plantilla trae 3 ejemplos, cargo {r8.cargados}"
    print("PASS: la plantilla descargable pasa su propia validacion")

    # ── 11. Excel .xlsx de verdad ─────────────────────────────────────────────
    try:
        from openpyxl import Workbook
        wb = Workbook(); hoja = wb.active
        hoja.append(["RUT", "Nombre completo", "Cargo"])
        hoja.append(["6.500.221-3", "Rosa Núñez", "Bodeguera"])
        buf = io.BytesIO(); wb.save(buf)
        cuarta = EmpresaContratista(rut="79.777.888-9", razon_social="Cuarta SpA")
        db.add(cuarta); db.commit()
        r9 = nomina_service.importar_nomina(db, cuarta.id, buf.getvalue(), "nomina.xlsx")
        assert r9.cargados == 1, f"no cargo el xlsx: {[e.motivo for e in r9.errores]}"
        rosa = db.query(Trabajador).filter_by(empresa_id=cuarta.id).first()
        assert rosa.rut == "6.500.221-3" and rosa.nombre_completo == "Rosa Núñez"
        print("PASS: lee archivos .xlsx reales")
    except ImportError:
        print("SKIP: openpyxl no instalado, no se probo .xlsx")

    print("TODOS LOS TESTS DE NOMINA PASARON")


if __name__ == "__main__":
    run()
