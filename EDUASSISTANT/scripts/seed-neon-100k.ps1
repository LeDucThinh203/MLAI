$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'

if (-not (Test-Path -LiteralPath $envFile) -and (-not $env:DATABASE_URL -or -not $env:JWT_SECRET)) {
    throw 'Set DATABASE_URL and JWT_SECRET in EDUASSISTANT/.env or in the current PowerShell environment first.'
}

Push-Location $projectRoot
try {
    & .\mvnw.cmd -f backend\pom.xml -q -DskipTests package
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & java -jar backend\target\eduassistant-backend.jar `
        --spring.main.web-application-type=none `
        --logging.level.root=WARN `
        --eduassistant.bulk-accounts.direct-seed=true `
        --eduassistant.bulk-accounts.confirmation=CREATE_100000_USERS
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
