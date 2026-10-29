$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
New-Item -ItemType Directory -Force .local | Out-Null
Set-Content .local/.gitignore '*'
docker compose -f gai-backend/docker-compose.yml up -d mysql
if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar MySQL.' }
if (Test-Path .local/storage-compose.yaml) {
  docker compose -p gai-local-storage -f .local/storage-compose.yaml up -d
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar storage local.' }
}
# Nao iniciar uma API com schema/catalogo incompleto; nunca aplicar automaticamente.
node.exe scripts/local-check-migrations.cjs
if ($LASTEXITCODE -ne 0) { throw 'Banco local desatualizado ou indisponivel; consulte o diagnostico acima.' }
$services = @(
  @{ Name='backend'; Directory='gai-backend'; Port=3000; Arguments=@('node_modules/@nestjs/cli/bin/nest.js','start','--watch') },
  @{ Name='frontend'; Directory='gai-frontend'; Port=5173; Arguments=@('node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort') }
)
foreach ($service in $services) {
  $busy = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq $service.Port
  if ($busy) { Write-Host "$($service.Name): porta $($service.Port) ocupada; processo existente preservado."; continue }
  $process = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList $service.Arguments -WorkingDirectory "$projectRoot/$($service.Directory)" -WindowStyle Hidden -RedirectStandardOutput "$projectRoot/.local/$($service.Name).log" -RedirectStandardError "$projectRoot/.local/$($service.Name)-error.log" -PassThru
  Set-Content ".local/$($service.Name).pid" $process.Id
  Write-Host "$($service.Name): PID $($process.Id), porta $($service.Port)"
}
Write-Host 'Frontend: http://localhost:5173 | Swagger: http://localhost:3000/api/docs'
