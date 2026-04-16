$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Get-Item "$scriptDir\..").FullName

$global:Pass = 0
$global:Fail = 0
$global:Warn = 0

function Check-Pass {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
    $script:Pass++
}

function Check-Fail {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    $script:Fail++
}

function Check-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
    $script:Warn++
}

Write-Host "=========================================="
Write-Host "  Pre-Deploy Check - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  Project Root: $projectRoot"
Write-Host "=========================================="

Set-Location $projectRoot

$envFile = Join-Path $projectRoot ".env.production"

if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    
    if ([string]::IsNullOrWhiteSpace($envContent)) {
        Check-Fail ".env.production exists but is empty - DEPLOYMENT BLOCKED"
    } else {
        Check-Pass ".env.production exists and non-empty"
        
        $dbHost = ""
        $dbUser = ""
        $dbPassword = ""
        $dbName = ""
        
        foreach ($line in ($envContent -split "`n")) {
            $line = $line.Trim()
            if ($line -match "^DB_HOST=(.*)$") { $dbHost = $Matches[1].Trim() }
            elseif ($line -match "^DB_USER=(.*)$") { $dbUser = $Matches[1].Trim() }
            elseif ($line -match "^DB_PASSWORD=(.*)$") { $dbPassword = $Matches[1].Trim() }
            elseif ($line -match "^DB_NAME=(.*)$") { $dbName = $Matches[1].Trim() }
        }
        
        if ($dbHost -eq "localhost" -or [string]::IsNullOrWhiteSpace($dbHost)) {
            Check-Fail "DB_HOST is using default value: '$($dbHost -or 'localhost')'"
        } else {
            Check-Pass "DB_HOST configured: $dbHost"
        }
        
        if ($dbUser -eq "root" -or [string]::IsNullOrWhiteSpace($dbUser)) {
            Check-Fail "DB_USER is using default value: '$($dbUser -or 'root')' (security risk)"
        } else {
            Check-Pass "DB_USER configured: $dbUser"
        }
        
        if ([string]::IsNullOrWhiteSpace($dbPassword)) {
            Check-Fail "DB_PASSWORD is empty - security risk"
        } else {
            Check-Pass "DB_PASSWORD is set (length: $($dbPassword.Length))"
        }
        
        if ($dbName -eq "ecommerce") {
            Check-Warn "DB_NAME is using default value: '$dbName' (may conflict with dev DB)"
        } elseif ([string]::IsNullOrWhiteSpace($dbName)) {
            Check-Fail "DB_NAME is empty"
        } else {
            Check-Pass "DB_NAME configured: $dbName"
        }
    }
} else {
    Check-Fail ".env.production missing - DEPLOYMENT BLOCKED"
}

$distPath = Join-Path $projectRoot "qiguanqianduan\dist"
$indexHtml = Join-Path $distPath "index.html"

if (Test-Path $distPath -and Test-Path $indexHtml) {
    $jsFiles = @(Get-ChildItem -Path "$distPath\assets\js" -Filter "*.js" -ErrorAction SilentlyContinue)
    $cssFiles = @(Get-ChildItem -Path "$distPath\assets\css" -Filter "*.css" -ErrorAction SilentlyContinue)
    
    if ($jsFiles.Count -gt 0 -and $cssFiles.Count -gt 0) {
        Check-Pass "Frontend dist files exist (index.html + $($jsFiles.Count) JS + $($cssFiles.Count) CSS)"
    } else {
        Check-Warn "Frontend dist exists but may be incomplete (JS:$($jsFiles.Count), CSS:$($cssFiles.Count))"
    }
} else {
    Check-Fail "Frontend build incomplete: dist/index.html missing"
}

try {
    $nodeVersionOutput = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $nodeVersion = $nodeVersionOutput -replace 'v', ''
        $nodeMajor = [int]($nodeVersion -split '\.')[0]
        
        if ($nodeMajor -ge 16) {
            Check-Pass "Node.js version >= 16: v$nodeVersion"
        } else {
            Check-Fail "Node.js version too old: v$nodeVersion (requires >= 16)"
        }
    } else {
        Check-Fail "Node.js not found in PATH"
    }
} catch {
    Check-Fail "Node.js not found or error checking version: $_"
}

$nodeModulesPath = Join-Path $projectRoot "node_modules"
if (Test-Path $nodeModulesPath) {
    $depCount = (Get-ChildItem -Path $nodeModulesPath -Directory | Measure-Object).Count
    Check-Pass "npm dependencies installed ($depCount packages in node_modules)"
} else {
    Check-Fail "node_modules missing - run 'npm install' first"
}

Write-Host ""
Write-Host "=========================================="
Write-Host "Results: $script:Pass passed, $script:Warn warnings, $script:Fail failed"
Write-Host "=========================================="

if ($script:Fail -gt 0) {
    Write-Host "[BLOCKED] Deployment BLOCKED - Fix failed checks above" -ForegroundColor Red
    exit 1
} elseif ($script:Warn -gt 0) {
    Write-Host "[WARNING] Deployment allowed with warnings - Review warnings above" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "[SUCCESS] All checks passed - Ready to deploy" -ForegroundColor Green
    exit 0
}
