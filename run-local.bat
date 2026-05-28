@echo off
IF NOT EXIST .env (
  echo No existe archivo .env. Generando secretos locales fuertes...
  cd backend
  call npm run create-env
  cd ..
)
echo Starting Berisa Platform...
docker compose up --build
pause
