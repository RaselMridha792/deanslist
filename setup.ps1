# ---------------------------------------------------------------------------
# Dean's List project bootstrap (Windows / PowerShell)
# Run from inside D:\codes\deanleas
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
# ---------------------------------------------------------------------------

Write-Host "`n=== Dean's List setup ===" -ForegroundColor Yellow

# 1. Check Node
try {
    $nodeVersion = node -v
    Write-Host "Node found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js not found. Install Node 20 LTS or newer from https://nodejs.org first." -ForegroundColor Red
    exit 1
}

# 2. Env file
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example" -ForegroundColor Green

    # generate an auth secret
    $secret = -join ((1..64) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
    (Get-Content ".env") -replace 'AUTH_SECRET="change-me-to-a-long-random-string"', "AUTH_SECRET=`"$secret`"" | Set-Content ".env"
    Write-Host "Generated AUTH_SECRET" -ForegroundColor Green
} else {
    Write-Host ".env already exists, leaving it alone" -ForegroundColor DarkGray
}

# 3. Install dependencies
Write-Host "`nInstalling dependencies (this takes a few minutes)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed." -ForegroundColor Red
    exit 1
}

# 4. Prisma client
Write-Host "`nGenerating Prisma client..." -ForegroundColor Yellow
npx prisma generate

Write-Host "`n=== Setup complete ===" -ForegroundColor Green
Write-Host @"

Next steps:

  1. Open .env and set DATABASE_URL to your PostgreSQL connection string.
     Local option:  install PostgreSQL 16 and create a database named deanslist
     Cloud option:  create a free Neon or Supabase database and paste the URL

  2. Push the schema to the database:
       npm run db:push

  3. Create the first admin user and a sample show:
       npm run db:seed

  4. Start the dev server:
       npm run dev

  5. Open http://localhost:3000  and  http://localhost:3000/admin

"@ -ForegroundColor Cyan
