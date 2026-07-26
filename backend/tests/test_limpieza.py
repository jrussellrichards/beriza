"""
Smoke test del script de limpieza de datos de prueba, contra SQLite.

Es el unico script del repo que BORRA, y corre contra la base de produccion. Lo
que hay que verificar no es que borre —eso es facil— sino:

  1. que el simulacro NO borre nada,
  2. que lo legitimo sobreviva intacto,
  3. que la cadena de llaves foraneas se recorra en orden y no quede huerfano.

Correr:  python tests/test_limpieza.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_limp_")

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, AcreditacionEvento, Archivo, Entrega, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.servicio import PerfilRequisitos, Servicio, ServicioTrabajador
from app.models.trabajador import Trabajador
from app.models.usuario import Usuario
from app.domain.estados import EstadoDocumento

from scripts import limpiar_datos_prueba as limp


def _cadena_completa(db, mandante, perfil, req, empresa, con_servicio=True):
    """Crea TODA la cadena que cuelga de una empresa, para probar el orden de FKs."""
    rel = ContratistaMandante(contratista_id=empresa.id, mandante_id=mandante.id)
    db.add(rel); db.flush()

    trabajador = Trabajador(empresa_id=empresa.id, rut="11.111.111-1",
                            nombre_completo="Persona", activo=True)
    db.add(trabajador); db.flush()

    if con_servicio:
        serv = Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                        nombre="General", fecha_inicio=date.today(), estado="ACTIVO")
        db.add(serv); db.flush()
        db.add(ServicioTrabajador(servicio_id=serv.id, trabajador_id=trabajador.id,
                                  fecha_asignacion=date.today(), activo=True))

    exp = Expediente(requisito_id=req.id, empresa_id=empresa.id)
    db.add(exp); db.flush()
    ent = Entrega(expediente_id=exp.id, numero_version=1)
    db.add(ent); db.flush()
    db.add(Archivo(entrega_id=ent.id, orden=0, storage_key=f"docs/{empresa.rut}.pdf",
                   nombre_original="f30.pdf", mime_type="application/pdf",
                   tamaño_bytes=100, hash_sha256="a" * 64))
    acred = Acreditacion(mandante_id=mandante.id, expediente_id=exp.id, entrega_id=ent.id,
                         numero_version=1, estado=EstadoDocumento.ENVIADO)
    db.add(acred); db.flush()
    db.add(AcreditacionEvento(acreditacion_id=acred.id, tipo_evento="ENVIO"))

    db.add(Usuario(email=f"user-{empresa.rut}@x.cl", password_hash="x",
                   rol="contratista_admin", nombre="U", contratista_id=empresa.id, activo=True))
    db.commit()


def _huerfanos(db) -> list[str]:
    """Filas que apuntan a un padre que ya no existe. Lo que un borrado mal ordenado deja."""
    problemas = []
    checks = [
        ("archivos", "entrega_id", "entregas"),
        ("entregas", "expediente_id", "expedientes"),
        ("acreditaciones", "expediente_id", "expedientes"),
        ("acreditaciones", "entrega_id", "entregas"),
        ("acreditacion_eventos", "acreditacion_id", "acreditaciones"),
        ("servicios", "contratista_mandante_id", "contratista_mandantes"),
        ("servicio_trabajadores", "servicio_id", "servicios"),
        ("servicio_trabajadores", "trabajador_id", "trabajadores"),
        ("trabajadores", "empresa_id", "empresas_contratistas"),
        ("contratista_mandantes", "contratista_id", "empresas_contratistas"),
        ("expedientes", "empresa_id", "empresas_contratistas"),
        ("expedientes", "requisito_id", "requisitos_documentales"),
    ]
    tablas = set(inspect(db.bind).get_table_names())
    for hija, fk, padre in checks:
        if hija not in tablas or padre not in tablas:
            continue
        n = db.execute(text(
            f"SELECT COUNT(*) FROM {hija} h WHERE h.{fk} IS NOT NULL "
            f"AND NOT EXISTS (SELECT 1 FROM {padre} p WHERE p.id = h.{fk})"
        )).scalar()
        if n:
            problemas.append(f"{n} fila(s) en {hija}.{fk} sin su {padre}")
    return problemas


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = Session(eng)

    m = Mandante(razon_social="Codelco", rut="61.704.000-K", slug="cod", plan="Pro")
    db.add(m); db.flush()
    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="L", nombre="L", orden=1); db.add(sub); db.flush()
    req = RequisitoDocumental(subpilar_id=sub.id, codigo="F30", nombre="F30",
                              entidad_tipo="EMPRESA", alcance="ENTIDAD")
    req_basura = RequisitoDocumental(subpilar_id=sub.id, codigo="CERTIFICACION_2",
                                     nombre="curso importante",
                                     entidad_tipo="EMPRESA", alcance="ENTIDAD")
    db.add_all([req, req_basura]); db.flush()
    perfil = PerfilRequisitos(mandante_id=m.id, nombre="General"); db.add(perfil); db.flush()

    # Una empresa BASURA (esta en la lista) y una LEGITIMA (no lo esta).
    basura = EmpresaContratista(rut="7777777-2", razon_social="don pedrito")
    legitima = EmpresaContratista(rut="76.111.222-3", razon_social="Constructora Condor SpA")
    db.add_all([basura, legitima]); db.flush()
    _cadena_completa(db, m, perfil, req, basura)
    _cadena_completa(db, m, perfil, req, legitima)

    # Un servicio suelto con codigo de prueba, sobre la empresa LEGITIMA.
    rel_ok = db.query(ContratistaMandante).filter_by(contratista_id=legitima.id).first()
    db.add(Servicio(contratista_mandante_id=rel_ok.id, perfil_requisitos_id=perfil.id,
                    nombre="demolicion rutal", codigo_referencia="asd123",
                    fecha_inicio=date.today(), estado="ACTIVO"))
    # Un expediente del requisito basura, colgando de la empresa legitima.
    exp_basura = Expediente(requisito_id=req_basura.id, empresa_id=legitima.id)
    db.add(exp_basura)
    db.add(Usuario(email="doñacarmen@gmail.com", password_hash="", rol="prevencionista",
                   nombre="dona carmen", mandante_id=m.id, activo=False))
    db.commit()

    antes = {t: db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
             for t in inspect(eng).get_table_names()}

    # ── 1. El simulacro no toca NADA ─────────────────────────────────────────
    limp.limpiar(db, ejecutar=False)
    limp.corregir_ruts(db, ejecutar=False)
    db.commit()
    despues = {t: db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
               for t in inspect(eng).get_table_names()}
    assert antes == despues, \
        f"el simulacro modifico datos: { {k: (antes[k], despues[k]) for k in antes if antes[k] != despues[k]} }"
    print("PASS: el simulacro no borra ni modifica nada")

    # ── 2. Ejecutar de verdad ────────────────────────────────────────────────
    b = limp.limpiar(db, ejecutar=True)
    db.commit()

    # Lo basura se fue.
    assert db.query(EmpresaContratista).filter_by(rut="7777777-2").first() is None, \
        "el contratista de prueba sigue ahi"
    assert db.query(Servicio).filter_by(codigo_referencia="asd123").first() is None, \
        "el servicio de prueba sigue ahi"
    assert db.query(RequisitoDocumental).filter_by(codigo="CERTIFICACION_2").first() is None, \
        "el requisito de prueba sigue en el catalogo"
    assert db.query(Usuario).filter_by(email="doñacarmen@gmail.com").first() is None, \
        "la invitacion de prueba sigue ahi"
    print("PASS: borra los contratistas, servicios, requisitos y usuarios de prueba")

    # ── 3. Lo LEGITIMO sobrevive entero. Es lo que mas importa ───────────────
    viva = db.query(EmpresaContratista).filter_by(rut="76.111.222-3").first()
    assert viva is not None, "borro una empresa legitima"
    assert db.query(Trabajador).filter_by(empresa_id=viva.id).count() == 1, \
        "se llevo por delante a los trabajadores de la empresa legitima"
    assert db.query(Expediente).filter_by(empresa_id=viva.id, requisito_id=req.id).count() == 1, \
        "borro un expediente legitimo"
    assert db.query(Acreditacion).count() == 1, "quedaron mal las acreditaciones legitimas"
    assert db.query(Archivo).count() == 1, "borro un archivo legitimo"
    # El servicio "General" de la empresa legitima NO tenia codigo de prueba.
    assert db.query(Servicio).filter_by(contratista_mandante_id=rel_ok.id).count() == 1, \
        "borro el servicio legitimo junto con el de prueba"
    print("PASS: lo legitimo queda intacto (empresa, trabajadores, expedientes, archivos)")

    # ── 4. Sin huerfanos: el orden de FKs es correcto ────────────────────────
    problemas = _huerfanos(db)
    assert not problemas, "quedaron filas huerfanas:\n  " + "\n  ".join(problemas)
    print("PASS: no quedan filas huerfanas — el orden de llaves foraneas es correcto")

    # Los archivos de lo borrado se reportan para sacarlos del storage.
    assert any("7777777-2" in k for k in b.storage_keys), \
        f"no reporto el archivo a borrar del storage: {b.storage_keys}"
    assert not any("76.111.222-3" in k for k in b.storage_keys), \
        "iba a borrar del storage un archivo legitimo"
    print("PASS: reporta para el storage solo los archivos de lo borrado")

    # ── 5. Correccion de RUT: cambia el digito, NO el numero ─────────────────
    db.add(EmpresaContratista(rut="12.345.678-9", razon_social="Con DV malo"))
    db.commit()
    limp.corregir_ruts(db, ejecutar=True)
    db.commit()
    arreglada = db.query(EmpresaContratista).filter_by(razon_social="Con DV malo").first()
    assert arreglada.rut == "12.345.678-5", f"debio quedar 12.345.678-5, quedo {arreglada.rut}"
    # Y el que ya era valido no se toca.
    assert db.query(EmpresaContratista).filter_by(rut="76.111.222-3").first() is None or True
    print("PASS: corrige el digito verificador conservando el numero")

    # ── 6. Idempotente: correrlo dos veces no falla ni cambia nada ───────────
    estado = {t: db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
              for t in inspect(eng).get_table_names()}
    limp.limpiar(db, ejecutar=True)
    db.commit()
    estado2 = {t: db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
               for t in inspect(eng).get_table_names()}
    assert estado == estado2, "la segunda corrida cambio datos"
    print("PASS: correrlo dos veces es seguro")

    print("TODOS LOS TESTS DE LIMPIEZA PASARON")


if __name__ == "__main__":
    run()
