$ErrorActionPreference = 'Stop'
$url = 'https://www.pulsocr.me/health/ready/'
$logDirectory = Join-Path $PSScriptRoot '..\logs'
$logPath = Join-Path $logDirectory 'render-keepalive.log'

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

while ($true) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
        Add-Content -Path $logPath -Value "$timestamp HTTP $([int]$response.StatusCode)"
    } catch {
        Add-Content -Path $logPath -Value "$timestamp ERROR $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 600
}
