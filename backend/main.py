from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import acreditacion, admin, documentos, mandantes, pilares, trabajadores, usuarios

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

app.include_router(acreditacion.router, prefix="/api/v1/acreditacion", tags=["acreditacion"])
app.include_router(documentos.router,   prefix="/api/v1/documentos",   tags=["documentos"])
app.include_router(mandantes.router,    prefix="/api/v1/mandantes",    tags=["mandantes"])
app.include_router(trabajadores.router, prefix="/api/v1/trabajadores", tags=["trabajadores"])
app.include_router(usuarios.router,     prefix="/api/v1/usuarios",     tags=["usuarios"])
app.include_router(admin.router,        prefix="/api/v1/admin",        tags=["admin"])
app.include_router(pilares.router,      prefix="/api/v1/pilares",      tags=["pilares"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
