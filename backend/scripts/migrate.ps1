# Carga el .env y corre alembic upgrade head
# Uso: .\scripts\migrate.ps1
# Uso con revision: .\scripts\migrate.ps1 revision "descripcion"

$envFile = Join-Path $PSScriptRoot "..\..\..\.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.+)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

if ($args[0] -eq "revision") {
    alembic revision --autogenerate -m $args[1]
} else {
    alembic upgrade head
}
