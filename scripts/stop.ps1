[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $ProjectRoot ".psde-runtime"
$StatePath = Join-Path $RuntimeRoot "processes.json"

if (-not (Test-Path $StatePath)) {
    Write-Host "[PSDE] No tracked services found."
    exit 0
}

$records = Get-Content $StatePath -Raw | ConvertFrom-Json
foreach ($record in $records) {
    $process = Get-Process -Id ([int]$record.Pid) -ErrorAction SilentlyContinue
    if ($null -ne $process) {
        Write-Host "[PSDE] Stopping $($record.Name) (PID $($record.Pid))"
        Stop-Process -Id ([int]$record.Pid) -Force
    } else {
        Write-Host "[PSDE] $($record.Name) (PID $($record.Pid)) is already stopped."
    }
}
Remove-Item $StatePath -Force
Write-Host "[PSDE] Tracked PSDE services stopped. Databases and research results were not changed."
