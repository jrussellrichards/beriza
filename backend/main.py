import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api import acreditacion, admin, documentos, mandantes, pilares, servicios, trabajadores, usuarios

logger = logging.getLogger("acredita")

app = FastAPI(
    title="Acredita API",
    version="1.0.0",
    docs_url="/api/docs" if settings.ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def error_interno(request: Request, exc: Exception) -> JSONResponse:
    """
    Envuelve errores no manejados en un JSON 500 que SÍ pasa por el
    middleware de CORS — sin esto, el navegador enmascara cualquier 500
    como un falso error de CORS y el frontend no puede mostrar el detalle.
    """
    logger.exception("Error no manejado en %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor. El equipo fue notificado."},
    )

app.include_router(acreditacion.router, prefix="/api/v1/acreditacion", tags=["acreditacion"])
app.include_router(documentos.router,   prefix="/api/v1/documentos",   tags=["documentos"])
app.include_router(mandantes.router,    prefix="/api/v1/mandantes",    tags=["mandantes"])
app.include_router(servicios.router,    prefix="/api/v1/servicios",    tags=["servicios"])
app.include_router(trabajadores.router, prefix="/api/v1/trabajadores", tags=["trabajadores"])
app.include_router(usuarios.router,     prefix="/api/v1/usuarios",     tags=["usuarios"])
app.include_router(admin.router,        prefix="/api/v1/admin",        tags=["admin"])
app.include_router(pilares.router,      prefix="/api/v1/pilares",      tags=["pilares"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
