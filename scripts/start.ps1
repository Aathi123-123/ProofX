[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$Wait
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot "backend"
$FrontendRoot = Join-Path $ProjectRoot "frontend"
$BlockchainRoot = Join-Path $ProjectRoot "blockchain"
$RuntimeRoot = Join-Path $ProjectRoot ".psde-runtime"
$LogRoot = Join-Path $RuntimeRoot "logs"
$StatePath = Join-Path $RuntimeRoot "processes.json"

function Write-Info([string]$Message) {
    Write-Host "[PSDE] $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw "[PSDE] $Message"
}

function Require-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Fail "$Name was not found. $InstallHint"
    }
}

function Get-EnvValue([string]$Name, [string]$DefaultValue) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $DefaultValue
    }
    return $value
}

function Get-EnvFileValue([string]$Name) {
    $envPath = Join-Path $BackendRoot ".env"
    if (-not (Test-Path $envPath)) {
        return $null
    }
    $line = Get-Content $envPath | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
    if ($null -eq $line) {
        return $null
    }
    return (($line -split "=", 2)[1]).Trim().Trim("'").Trim('"')
}

function Test-TcpPort([string]$HostName, [int]$Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        $connected = $async.AsyncWaitHandle.WaitOne(1000)
        if ($connected -and $client.Connected) {
            $client.EndConnect($async)
            $client.Close()
            return $true
        }
        $client.Close()
    } catch {
        return $false
    }
    return $false
}

function Wait-Http([string]$Url, [int]$TimeoutSeconds = 30) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        } catch {
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    Fail "Service did not become ready: $Url"
}

function Wait-Tcp([string]$HostName, [int]$Port, [int]$TimeoutSeconds = 30) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-TcpPort $HostName $Port) {
            return
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    Fail "Service did not open TCP port ${HostName}:${Port}"
}

function Start-LoggedProcess(
    [string]$Name,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory
) {
    $stdout = Join-Path $LogRoot "$Name.out.log"
    $stderr = Join-Path $LogRoot "$Name.err.log"
    $stdin = Join-Path $RuntimeRoot "stdin.null"
    if (-not (Test-Path $stdin)) {
        New-Item -ItemType File -Path $stdin -Force | Out-Null
    }
    $argumentLine = ($Arguments | ForEach-Object {
        if ($_ -match "\s") { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
    }) -join " "
    $process = Start-Process -FilePath $FilePath -ArgumentList $argumentLine `
        -WorkingDirectory $WorkingDirectory -RedirectStandardInput $stdin `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr -PassThru
    return [pscustomobject]@{
        Name = $Name
        Pid = $process.Id
        Command = "$FilePath $argumentLine"
        Stdout = $stdout
        Stderr = $stderr
    }
}

function Save-State($Items) {
    @($Items) | ConvertTo-Json -Depth 4 | Set-Content $StatePath -Encoding UTF8
}

New-Item -ItemType Directory -Path $RuntimeRoot, $LogRoot -Force | Out-Null
Require-Command "npm.cmd" "Install Node.js LTS and reopen PowerShell."
Require-Command "Get-Command" "PowerShell is required."

$python = Join-Path $BackendRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Fail "Backend Python environment is missing at $python. Create it and install backend\requirements.txt."
}
if (-not (Test-Path (Join-Path $FrontendRoot "package.json"))) {
    Fail "Frontend package.json was not found."
}
if (-not (Test-Path (Join-Path $BlockchainRoot "package.json"))) {
    Fail "Blockchain package.json was not found."
}

$backendPort = [int](Get-EnvValue "PSDE_BACKEND_PORT" "8000")
$frontendPort = [int](Get-EnvValue "PSDE_FRONTEND_PORT" "5173")
$blockchainPort = [int](Get-EnvValue "PSDE_BLOCKCHAIN_PORT" "8545")
$env:BLOCKCHAIN_RPC_URL = "http://127.0.0.1:$blockchainPort"
$databaseUrl = Get-EnvValue "DATABASE_URL" (Get-EnvFileValue "DATABASE_URL")
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    $databaseUrl = "sqlite+aiosqlite:///./psde.db"
}

if ($CheckOnly) {
    Write-Info "Configuration check passed."
    Write-Info "Database: $databaseUrl"
    Write-Info "Ports: backend=$backendPort frontend=$frontendPort blockchain=$blockchainPort"
    exit 0
}

if ($databaseUrl -notmatch "^sqlite") {
    $postgresHost = Get-EnvValue "PSDE_POSTGRES_HOST" "127.0.0.1"
    $postgresPort = [int](Get-EnvValue "PSDE_POSTGRES_PORT" "5432")
    if (-not (Test-TcpPort $postgresHost $postgresPort)) {
        Fail "PostgreSQL is not reachable at ${postgresHost}:${postgresPort}. Start PostgreSQL or set DATABASE_URL in backend\.env to the intended server; credentials must be supplied through environment variables."
    }
    Write-Info "PostgreSQL is reachable at ${postgresHost}:${postgresPort}."
} else {
    Write-Info "Using configured SQLite database; PostgreSQL is not required."
}

$records = [System.Collections.ArrayList]@()
if (Test-Path $StatePath) {
    try {
        $parsed = Get-Content $StatePath -Raw | ConvertFrom-Json
        if ($parsed -is [System.Array]) { $records = [System.Collections.ArrayList]@($parsed) }
        else { $records = [System.Collections.ArrayList]@($parsed) }
    } catch { $records = [System.Collections.ArrayList]@() }
}
$existing = @($records | Where-Object { Get-Process -Id $_.Pid -ErrorAction SilentlyContinue })
if ($existing.Count -gt 0) {
    Fail "PSDE services are already tracked in $StatePath. Run .\scripts\stop.ps1 first."
}

if (-not (Test-TcpPort "127.0.0.1" $blockchainPort)) {
    Write-Info "Starting Hardhat node..."
    $hardhat = Start-LoggedProcess "hardhat" "npm.cmd" @("--prefix", $BlockchainRoot, "run", "node", "--", "--hostname", "127.0.0.1", "--port", "$blockchainPort") $ProjectRoot
    $records.Add($hardhat) | Out-Null
    Save-State $records
    Wait-Tcp "127.0.0.1" $blockchainPort 60
} else {
    Write-Info "Hardhat is already reachable on port $blockchainPort; it will not be stopped by this run."
}

Write-Info "Deploying/verifying the local commitment contract..."
$deployLog = Join-Path $LogRoot "blockchain-deploy.log"
$previousAddress = Get-EnvValue "COMMITMENT_CONTRACT_ADDRESS" (Get-EnvFileValue "COMMITMENT_CONTRACT_ADDRESS")
& npm.cmd --prefix $BlockchainRoot run deploy *> $deployLog
if ($LASTEXITCODE -ne 0) {
    Fail "Blockchain deployment failed. Inspect $deployLog."
}
$deployText = Get-Content $deployLog -Raw
$match = [regex]::Match($deployText, "ForensicCommitment deployed to:\s*(0x[a-fA-F0-9]{40})")
if ($match.Success) {
    $env:COMMITMENT_CONTRACT_ADDRESS = $match.Groups[1].Value
} elseif (-not [string]::IsNullOrWhiteSpace($previousAddress)) {
    $env:COMMITMENT_CONTRACT_ADDRESS = $previousAddress
} else {
    Fail "Deployment completed without a contract address. Inspect $deployLog."
}

Write-Info "Applying database migrations..."
Push-Location $BackendRoot
try {
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $python -m alembic upgrade head 2>&1 | Out-File (Join-Path $LogRoot "migrations.log")
    $migrationCode = $LASTEXITCODE
    & $python -m app.core.bootstrap 2>&1 | Out-File (Join-Path $LogRoot "bootstrap.log")
    $bootstrapCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorAction
    if ($migrationCode -ne 0) { Fail "Database migration failed. Inspect $(Join-Path $LogRoot "migrations.log")." }
    if ($bootstrapCode -ne 0) { Fail "Admin bootstrap failed. Inspect $(Join-Path $LogRoot "bootstrap.log")." }
} finally {
    Pop-Location
}

$env:DATABASE_URL = $databaseUrl
$env:PSDE_BACKEND_PORT = "$backendPort"
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:$backendPort"
if (Test-TcpPort "127.0.0.1" $backendPort) {
    Fail "Backend port $backendPort is already in use. Set PSDE_BACKEND_PORT to a free port or stop the owning service yourself."
}
Write-Info "Starting backend..."
$backend = Start-LoggedProcess "backend" $python @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$backendPort") $BackendRoot
$records.Add($backend) | Out-Null
Save-State $records
Wait-Http "http://127.0.0.1:$backendPort/health"

if (Test-TcpPort "127.0.0.1" $frontendPort) {
    Fail "Frontend port $frontendPort is already in use. Set PSDE_FRONTEND_PORT to a free port or stop the owning service yourself."
}
Write-Info "Starting frontend..."
$frontend = Start-LoggedProcess "frontend" "node.exe" @("node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "$frontendPort") $FrontendRoot
$records.Add($frontend) | Out-Null
Save-State $records
Wait-Http "http://127.0.0.1:$frontendPort" 60

Write-Info "PSDE is ready."
Write-Host "Frontend: http://localhost:$frontendPort"
Write-Host "Backend:  http://127.0.0.1:$backendPort/docs"
Write-Host "Blockchain: http://127.0.0.1:$blockchainPort"
Write-Host "Logs: $LogRoot"

if ($Wait) {
    Write-Host "[PSDE] Services are running in background. Monitoring..."
    while ($true) {
        Start-Sleep -Seconds 60
    }
}
