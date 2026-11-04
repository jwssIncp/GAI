$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
foreach ($name in @('frontend', 'backend')) {
  $pidFile = ".local/$name.pid"
  if (Test-Path $pidFile) {
    $serviceProcessId = [int](Get-Content $pidFile)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$serviceProcessId" -ErrorAction SilentlyContinue
    if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine -match 'node_modules[/\\](vite|@nestjs)') {
      taskkill.exe /PID $serviceProcessId /T /F
    }
    Remove-Item -LiteralPath $pidFile
  }
}
docker compose -f gai-backend/docker-compose.yml stop mysql
if (Test-Path .local/storage-compose.yaml) {
  docker compose -p gai-local-storage -f .local/storage-compose.yaml stop
}
