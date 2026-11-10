param([switch]$Watch)

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
$backendArguments = @('node_modules/@nestjs/cli/bin/nest.js','start','--watch')
if (-not $Watch) {
  $backendBusy = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq 3000
  if (-not $backendBusy) {
    Push-Location "$projectRoot/gai-backend"
    try {
      npm.cmd run build
      if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar a API; nenhum processo foi iniciado.' }
    } finally { Pop-Location }
  }
  $backendArguments = @('"' + "$projectRoot/gai-backend/dist/src/main.js" + '"')
}

function Wait-LocalService($service, $serviceProcess = $null) {
  $deadline = (Get-Date).AddSeconds(60)
  do {
    if ($serviceProcess -and $serviceProcess.HasExited) {
      throw "$($service.Name) encerrou com codigo $($serviceProcess.ExitCode). Consulte .local/$($service.Name)-error.log."
    }
    try {
      $response = Invoke-WebRequest -Uri $service.HealthUrl -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { return }
    } catch { }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "$($service.Name) nao respondeu em $($service.HealthUrl). Consulte .local/$($service.Name).log e .local/$($service.Name)-error.log."
}

$services = @(
  @{ Name='backend'; Directory='gai-backend'; Port=3000; Arguments=$backendArguments; HealthUrl='http://127.0.0.1:3000/api/v1/health' },
  @{ Name='frontend'; Directory='gai-frontend'; Port=5173; Arguments=@('node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort'); HealthUrl='http://127.0.0.1:5173/api/v1/health' }
)
foreach ($service in $services) {
  $busy = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq $service.Port
  if ($busy) {
    Wait-LocalService $service
    Write-Host "$($service.Name): servico existente respondeu na porta $($service.Port)."
    continue
  }
  $process = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList $service.Arguments -WorkingDirectory "$projectRoot/$($service.Directory)" -WindowStyle Hidden -RedirectStandardOutput "$projectRoot/.local/$($service.Name).log" -RedirectStandardError "$projectRoot/.local/$($service.Name)-error.log" -PassThru
  Set-Content ".local/$($service.Name).pid" $process.Id
  Wait-LocalService $service $process
  Write-Host "$($service.Name): PID $($process.Id), porta $($service.Port)"
}
Write-Host 'Frontend: http://localhost:5173 | Swagger: http://localhost:3000/api/docs'
