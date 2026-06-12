# =============================================================================
#  Doctium - local database setup
# -----------------------------------------------------------------------------
#  Creates the `doctium_app` role and `doctium_app_db` database in your local
#  PostgreSQL 17 WITHOUT needing (or changing) your forgotten `postgres`
#  superuser password.
#
#  How it works (standard forgotten-password recovery):
#    1. Backs up pg_hba.conf
#    2. Temporarily lets LOCAL connections in without a password
#    3. Restarts PostgreSQL
#    4. Creates the role + database
#    5. Restores the original pg_hba.conf (password security back on)
#    6. Restarts PostgreSQL again
#
#  Your `postgres` superuser password is NOT modified.
#  Note: this briefly restarts PostgreSQL twice, so any OTHER local project
#  using it will reconnect (fine for local dev).
#
#  >>> Run this in an ELEVATED (Administrator) PowerShell window. <<<
# =============================================================================

$ErrorActionPreference = 'Stop'

$pgBin   = 'C:\Program Files\PostgreSQL\17\bin'
$pgData  = 'C:\Program Files\PostgreSQL\17\data'
$hba     = Join-Path $pgData 'pg_hba.conf'
$backup  = Join-Path $pgData 'pg_hba.conf.doctium-backup'
$service = 'postgresql-x64-17'
$psql    = Join-Path $pgBin 'psql.exe'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Please run this in an ELEVATED (Administrator) PowerShell." -ForegroundColor Red
    exit 1
}

Write-Host "1/6  Backing up pg_hba.conf -> $backup"
Copy-Item $hba $backup -Force

try {
    Write-Host "2/6  Adding a temporary trust rule for local connections ..."
    $trust = @(
        '# === TEMP (Doctium setup) ===',
        'host    all    all    127.0.0.1/32    trust',
        'host    all    all    ::1/128         trust',
        '# === end TEMP ==='
    )
    Set-Content -Path $hba -Value ($trust + (Get-Content $hba)) -Encoding ASCII

    Write-Host "3/6  Restarting PostgreSQL so the rule takes effect ..."
    Restart-Service $service
    Start-Sleep -Seconds 3

    Write-Host "4/6  Creating role 'doctium_app' and database 'doctium_app_db' ..."
    # CREATEDB is granted so Prisma's `migrate dev` can create its shadow database.
    $sql = @'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'doctium_app') THEN
    CREATE ROLE doctium_app LOGIN CREATEDB PASSWORD 'doctiumapp123!';
  END IF;
END $$;
SELECT 'CREATE DATABASE doctium_app_db OWNER doctium_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'doctium_app_db')\gexec
'@
    $tmpSql = Join-Path $env:TEMP 'doctium_db_setup.sql'
    Set-Content -Path $tmpSql -Value $sql -Encoding ASCII
    & $psql -U postgres -h localhost -v ON_ERROR_STOP=1 -f $tmpSql
    Remove-Item $tmpSql -Force
}
finally {
    Write-Host "5/6  Restoring original pg_hba.conf ..."
    Copy-Item $backup $hba -Force
    Write-Host "6/6  Restarting PostgreSQL with original security ..."
    Restart-Service $service
}

Write-Host ""
Write-Host "DONE. Created role 'doctium_app' + database 'doctium_app_db'." -ForegroundColor Green
Write-Host "Your 'postgres' superuser password was NOT changed."
Write-Host "Tell Claude it's done and it will run the migrations."
