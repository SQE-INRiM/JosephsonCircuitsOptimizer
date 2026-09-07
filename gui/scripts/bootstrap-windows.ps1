$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $Root '.jco-runtime'
$NodeVersion = '22.22.0'
$NodeDirName = "node-v$NodeVersion-win-x64"
$NodeDir = Join-Path $RuntimeDir $NodeDirName
$NodeExe = Join-Path $NodeDir 'node.exe'
$NpmCmd = Join-Path $NodeDir 'npm.cmd'
$NodeZip = Join-Path $RuntimeDir "$NodeDirName.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeDirName.zip"

function Write-Step([string]$Message) {
    Write-Host "[JCO GUI] $Message"
}

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "[JCO GUI] ERROR: $Message" -ForegroundColor Red
    exit 1
}

Set-Location $Root
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

if (-not (Test-Path $NodeExe)) {
    Write-Step "Preparing the local runtime (first launch only)..."
    Write-Step "Downloading portable Node.js $NodeVersion..."
    try {
        Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip -UseBasicParsing
    } catch {
        Fail "Could not download Node.js. Check the internet connection. $($_.Exception.Message)"
    }

    Write-Step "Extracting local runtime..."
    try {
        Expand-Archive -Path $NodeZip -DestinationPath $RuntimeDir -Force
        Remove-Item $NodeZip -Force -ErrorAction SilentlyContinue
    } catch {
        Fail "Could not extract the local Node.js runtime. $($_.Exception.Message)"
    }
}

if (-not (Test-Path $NpmCmd)) {
    Fail "The local Node.js runtime is incomplete. Delete .jco-runtime and launch again."
}

# Make the local runtime visible only to this launcher and its child processes.
$env:PATH = "$NodeDir;$env:PATH"

if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    Write-Step "Installing GUI dependencies locally (first launch only)..."
    & $NpmCmd ci
    if ($LASTEXITCODE -ne 0) { Fail "npm dependency installation failed." }
}

Write-Step "Building the GUI..."
& $NpmCmd run build
if ($LASTEXITCODE -ne 0) { Fail "GUI build failed." }

if (-not (Test-Path (Join-Path $Root 'dist\index.html'))) {
    Fail "The GUI build did not create dist\index.html."
}

Write-Step "Opening JCO GUI..."
Write-Step "Julia is only needed when you start a JCO simulation."

& $NpmCmd exec --yes --package=electron@43.4.1 -- electron .
if ($LASTEXITCODE -ne 0) { Fail "Electron failed to start the application." }
