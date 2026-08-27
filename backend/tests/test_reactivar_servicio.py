"""
Reabrir un servicio TERMINADO, dejando registro.

Observacion #1c del feedback del 25 de agosto de 2026. "Terminar" era un boton
de un clic, al lado de "Suspender", SIN VUELTA ATRAS NUNCA. Dos situaciones
reales quedaban sin salida:

  1. Alguien aprieta Terminar queriendo Suspender.
  2. El contrato se reactiva de verdad: se extendio la obra.

En los dos casos la unica alternativa era crear un servicio nuevo desde cero, y
con eso se perdia el historial de acreditacion del anterior —quien estaba
habilitado, que documentos se aprobaron y cuando—. Justo lo que el producto
existe para conservar.

Lo que se verifica:

  1. que un TERMINADO se pueda reabrir,
  2. que EXIJA un motivo —reabrir un contrato cerrado es por lo que preguntan
     despues, y "alguien lo reactivo" sin el porque es medio registro—,
  3. que quede en la bitacora quien, cuando y por que,
  4. que al volver a ACTIVO las exigencias vuelvan a contar de inmediato,
  5. que no se pueda reactivar lo que no esta terminado ni lo archivado,
  6. y que la bitacora registre tambien terminar, archivar y desarchivar, que
     antes no dejaban rastro de nada.

Correr:  python tests/test_reactivar_servicio.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_reactivar_")

from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.exceptions import AsignacionInvalida, EstadoServicioInvalido
from app.domain import acreditacion_service, servicio_service
from app.domain.estados import EstadoAcreditacion, EstadoServicio
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.usuario import Usuario

from tests._db import engine_sqlite


def _armar(db):
    man = Mandante(razon_social="Minera Demo", rut="76.1-9", slug="m", plan="Pro")
    otro = Mandante(razon_social="Otra Minera", rut="76.9-1", slug="o", plan="Pro")
    emp = EmpresaContratista(razon_social="Contratista Demo", rut="77.2-8")
    db.add_all([man, otro, emp])
    db.flush()
    rel = ContratistaMandante(mandante_id=man.id, contratista_id=emp.id)
    usuario = Usuario(
        email="jefa@minera.cl", nombre="Jefa de Contratos", password_hash="",
        rol="mandante_admin", activo=True, mandante_id=man.id,
    )
    db.add_all([rel, usuario])
    db.flush()
    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1)
    db.add(pilar)
    db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="EMP", nombre="Empresa", orden=1)
    db.add(sub)
    db.flush()
    req = RequisitoDocumental(
        subpilar_id=sub.id, codigo="F30", nombre="Certificado F30",
        entidad_tipo="EMPRESA", alcance="ENTIDAD",
    )
    db.add(req)
    db.commit()
    perfil = servicio_service.crear_perfil(db, man.id, "Obra civil")
    servicio_service.configurar_requisito_perfil(
        db, perfil.id, req.id, es_obligatorio=True, vigencia_max_dias=90,
    )
    return man, otro, emp, rel, perfil, usuario


def run():
    eng = engine_sqlite()
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()
    man, otro, emp, rel, perfil, usuario = _armar(db)

    srv = servicio_service.crear_servicio(
        db, man.id, emp.id, perfil.id, "Ampliación planta", date.today(),
    )

    # ── 1. Sin motivo no se reactiva ─────────────────────────────────────────
    servicio_service.cambiar_estado_servicio(
        db, srv.id, EstadoServicio.TERMINADO, actor_usuario_id=usuario.id,
    )
    db.refresh(rel)
    assert rel.estado_acreditacion == EstadoAcreditacion.PENDIENTE, rel.estado_acreditacion

    for vacio in ("", "   ", None):
        try:
            servicio_service.reactivar_servicio(db, srv.id, man.id, vacio, usuario.id)
            raise AssertionError(
                f"se reactivo sin motivo ({vacio!r}). Reabrir un contrato cerrado es "
                f"la accion por la que preguntan despues; sin el porque, el registro "
                f"queda a medias.")
        except AsignacionInvalida as e:
            assert "por qué" in str(e) or "por que" in str(e), e
    db.refresh(srv)
    assert srv.estado == EstadoServicio.TERMINADO, "un intento fallido igual lo reactivo"
    print("PASS: sin motivo no se reactiva, y el intento fallido no deja nada a medias")

    # ── 2. Con motivo, se reabre ─────────────────────────────────────────────
    servicio_service.reactivar_servicio(
        db, srv.id, man.id, "Se extendió la obra hasta diciembre", usuario.id,
    )
    db.refresh(srv)
    assert srv.estado == EstadoServicio.ACTIVO, srv.estado
    assert srv.fecha_termino is None, (
        f"quedo fecha_termino={srv.fecha_termino}. Si el contrato volvio a estar "
        f"vigente, la fecha en que se cerro ya no describe nada.")
    print("PASS: con motivo, el servicio terminado vuelve a estar ACTIVO")

    # ── 3. Las exigencias vuelven a contar de inmediato ──────────────────────
    db.refresh(rel)
    assert rel.estado_acreditacion == EstadoAcreditacion.BLOQUEADA, (
        f"tras reactivar quedo {rel.estado_acreditacion}. Al volver a ACTIVO, el "
        f"F30 que falta vuelve a ser una brecha. Si no se recalcula, se estaria "
        f"dejando pasar gente a una faena reabierta sin papeles.")
    print("PASS: al reabrir, las exigencias vuelven a contar y vuelve a BLOQUEADA")

    # ── 4. La bitacora tiene quien, cuando y por que ─────────────────────────
    historial = servicio_service.historial_servicio(db, srv.id)
    tipos = [e.tipo_evento for e in historial]
    assert "CAMBIO_ESTADO" in tipos and "REACTIVADO" in tipos, tipos

    react = [e for e in historial if e.tipo_evento == "REACTIVADO"][0]
    assert react.actor_usuario_id == usuario.id, "no quedo quien lo hizo"
    assert react.created_at is not None, "no quedo cuando"
    assert "Se extendió la obra" in react.motivo, react.motivo
    assert react.estado_anterior == EstadoServicio.TERMINADO
    assert react.estado_nuevo == EstadoServicio.ACTIVO
    # La fecha de cierre se conserva en el motivo, porque el campo se limpia
    assert "cerrado el" in react.motivo, (
        f"el motivo no conserva cuando se habia cerrado: {react.motivo!r}. Se "
        f"limpia fecha_termino, asi que si no queda aca se pierde.")
    print(f"PASS: la bitacora guarda quien, cuando y por que — «{react.motivo}»")

    # ── 5. No se reactiva lo que no esta terminado ───────────────────────────
    try:
        servicio_service.reactivar_servicio(db, srv.id, man.id, "otra vez", usuario.id)
        raise AssertionError("se 'reabrio' un servicio que ya estaba ACTIVO")
    except EstadoServicioInvalido as e:
        assert "no está terminado" in str(e), e
    print("PASS: no se puede reabrir algo que no estaba cerrado")

    # ── 6. Ni lo archivado ───────────────────────────────────────────────────
    servicio_service.cambiar_estado_servicio(db, srv.id, EstadoServicio.TERMINADO, usuario.id)
    servicio_service.archivar_servicio(db, srv.id, man.id, usuario.id)
    try:
        servicio_service.reactivar_servicio(db, srv.id, man.id, "motivo", usuario.id)
        raise AssertionError(
            "se reactivo un servicio archivado: volveria a la evaluacion sin "
            "aparecer en ninguna lista.")
    except EstadoServicioInvalido as e:
        assert "rchiv" in str(e).lower().replace("í", "i"), e
    print("PASS: un archivado no se reactiva sin desarchivarse primero")

    # ── 7. Aislamiento entre mandantes ───────────────────────────────────────
    servicio_service.desarchivar_servicio(db, srv.id, man.id)
    try:
        servicio_service.reactivar_servicio(db, srv.id, otro.id, "motivo", usuario.id)
        raise AssertionError("se reactivo un servicio de OTRO mandante")
    except AsignacionInvalida:
        pass
    print("PASS: no se puede reactivar un servicio de otro mandante")

    # ── 8. Todo lo que le pasa al servicio queda registrado ──────────────────
    # Antes no habia bitacora de servicio: se podia terminar una faena y nadie
    # sabia despues quien ni cuando.
    historial = servicio_service.historial_servicio(db, srv.id)
    tipos = [e.tipo_evento for e in historial]
    for esperado in ("CAMBIO_ESTADO", "REACTIVADO", "ARCHIVADO", "DESARCHIVADO"):
        assert esperado in tipos, f"falta {esperado} en la bitacora: {tipos}"
    # Y esta ordenada
    fechas = [e.created_at for e in historial]
    assert fechas == sorted(fechas), "la bitacora no viene en orden cronologico"
    print(f"PASS: la bitacora registra las {len(historial)} acciones, en orden: {tipos}")

    db.close()
    print("TODOS LOS TESTS DE REACTIVAR SERVICIO PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_reactivar_servicio():
    run()
