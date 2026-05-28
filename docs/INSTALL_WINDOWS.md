# Instalación rápida en Windows

## Requisito recomendado

- Docker Desktop instalado y en ejecución.

## Pasos

1. Descomprimir el archivo ZIP.
2. Abrir PowerShell o CMD en la carpeta del proyecto.
3. Ejecutar:

```powershell
docker compose up --build
```

4. Abrir en el navegador:

```text
http://localhost:8080
```

## Credenciales iniciales

No se incluyen credenciales por defecto. Antes de levantar Docker, genera `.env`:

```powershell
cd backend
npm run create-env
cd ..
```

El archivo `.env` contendrá el correo y la contraseña inicial configurables para el administrador local.
