import uuid
from sqlalchemy import String, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase


class Usuario(ModelBase):
    __tablename__ = "usuarios"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Roles: berisa_admin | mandante_admin | contratista_admin | prevencionista
    #
    # Dentro de un mandante el rol responde UNA sola pregunta: ¿administra la
    # cuenta? mandante_admin invita gente, configura perfiles de exigencias y
    # crea servicios; prevencionista no. El ALCANCE de aprobación es una pregunta
    # aparte —`aprueba_todo` y las filas de UsuarioPilarPermiso— porque juntarlas
    # obligaba a entregar la administración para que alguien aprobara todo.
    rol: Mapped[str] = mapped_column(String(30), nullable=False)

    # Aprueba cualquier pilar sin necesitar filas en usuario_pilar_permisos.
    # Es una columna en vez de "asignarle todos los pilares" para que siga
    # aprobando los pilares que el mandante active MAÑANA; con filas explícitas
    # dejaría de aprobarlos en silencio. Se ignora para los roles que ya aprueban
    # todo por definición (ver permiso_service.ROLES_SIN_RESTRICCION).
    aprueba_todo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Cargo declarado por el mandante ("Jefe de Terreno", "Gerente HSE"). Es una
    # ETIQUETA: no participa de ninguna decisión de autorización. Existe para no
    # tener que inventar roles a medida, que sí serían un motor de permisos.
    cargo: Mapped[str | None] = mapped_column(String(80), nullable=True)

    # Pertenece a un mandante O a una empresa contratista, nunca a ambos
    mandante_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("mandantes.id"), nullable=True)
    contratista_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("empresas_contratistas.id"), nullable=True)

    mandante: Mapped["Mandante | None"] = relationship(back_populates="usuarios")
    contratista: Mapped["EmpresaContratista | None"] = relationship(back_populates="usuarios")
