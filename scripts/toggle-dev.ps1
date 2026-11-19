param(
    [ValidateSet("Toggle", "Start", "Stop")]
    [string]$Action = "Toggle"
)

$ErrorActionPreference = "SilentlyContinue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

# One window per service, so closing a window (or Ctrl+C in it) stops just that one.
$Targets = @(
    @{ Name = "Backend";    Port = 9000; Cmd = "pnpm dev:backend";    Url = "http://localhost:9000" },
    @{ Name = "Admin";      Port = 7001; Cmd = "pnpm dev:admin";      Url = "http://localhost:7001" },
    @{ Name = "Storefront"; Port = 3000; Cmd = "pnpm dev:storefront"; Url = "http://localhost:3000" }
)

function Test-PortOpen($port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Stop-AllServices {
    Write-Host "Stopping Hidden Label dev servers..." -ForegroundColor Yellow
    $stoppedAny = $false
    foreach ($t in $Targets) {
        $conns = Get-NetTCPConnection -LocalPort $t.Port -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host ("  Stopped {0} (port {1}, pid {2})" -f $t.Name, $t.Port, $c.OwningProcess)
            $stoppedAny = $true
        }
    }
    if (-not $stoppedAny) {
        Write-Host "  Nothing was running." -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "The local database was left running (it's lightweight and safe to leave up)." -ForegroundColor Green
    Write-Host "Run this script again to start everything back up." -ForegroundColor Green
}

function Start-AllServices {
    Write-Host "Starting the local database..." -ForegroundColor Yellow
    & pnpm db:start 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

    Write-Host ""
    Write-Host "Starting Hidden Label dev servers (one window per service)..." -ForegroundColor Yellow
    foreach ($t in $Targets) {
        if (Test-PortOpen $t.Port) {
            Write-Host ("  {0} is already running on port {1} - skipped." -f $t.Name, $t.Port) -ForegroundColor DarkGray
            continue
        }
        Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $t.Cmd -WorkingDirectory $Root
        Write-Host ("  Started {0} -> {1}" -f $t.Name, $t.Url)
    }

    Write-Host ""
    Write-Host "Done. Open the storefront at http://localhost:3000 and the admin at http://localhost:7001." -ForegroundColor Green
    Write-Host "Run this script again to stop everything." -ForegroundColor Green
}

$anyRunning = $false
foreach ($t in $Targets) {
    if (Test-PortOpen $t.Port) { $anyRunning = $true }
}

switch ($Action) {
    "Start" { Start-AllServices }
    "Stop" { Stop-AllServices }
    default {
        if ($anyRunning) { Stop-AllServices } else { Start-AllServices }
    }
}

Write-Host ""
Write-Host "Press any key to close this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
