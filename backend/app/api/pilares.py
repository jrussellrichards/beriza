"""
Catálogo global de pilares y requisitos documentales.
Lectura pública para cualquier rol autenticado.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.pilar import Pilar, Subpilar, RequisitoDocumental

router = APIRouter()


@router.get("/")
def listar_pilares(
    db: Session = Depends(get_db),
    _=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """Catálogo completo: pilares → subpilares → requisitos documentales."""
    pilares = (
        db.query(Pilar)
        .options(
            joinedload(Pilar.subpilares).joinedload(Subpilar.requisitos)
        )
        .order_by(Pilar.orden)
        .all()
    )

    COLOR_MAP = {"LEGAL": "blue", "HSE": "amber", "COMPLIANCE": "purple"}

    resultado = []
    for p in pilares:
        subpilares = []
        for sp in sorted(p.subpilares, key=lambda x: x.orden):
            requisitos = [
                {
                    "id": str(r.id),
                    "codigo": r.codigo,
                    "nombre": r.nombre,
                    "entidad_tipo": r.entidad_tipo,
                }
                for r in sp.requisitos
            ]
            subpilares.append({
                "id": str(sp.id),
                "codigo": sp.codigo,
                "nombre": sp.nombre,
                "requisitos": requisitos,
            })
        resultado.append({
            "id": str(p.id),
            "codigo": p.codigo,
            "nombre": p.nombre,
            "orden": p.orden,
            "color": COLOR_MAP.get(p.codigo, "slate"),
            "subpilares": subpilares,
        })
    return resultado
