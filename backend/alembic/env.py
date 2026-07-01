from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Importamos settings para leer DATABASE_URL del .env
from app.core.config import settings

# Importamos todos los modelos para que Alembic los detecte en autogenerate
import app.models  # noqa: F401 — registra todos los modelos en Base.metadata
from app.models.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Apuntamos al metadata de nuestros modelos para autogenerate
target_metadata = Base.metadata

# Sobreescribimos la URL con la del .env — ignora el valor hardcoded en alembic.ini
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
