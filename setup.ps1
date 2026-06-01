# ASK_2026_sports Setup Script - Integrated Build and Run

Write-Host "🚀 ASK_2026_sports - Integrated Client & Server Setup" -ForegroundColor Green

# Step 1: Build Client
Write-Host "`n📦 Building Client..." -ForegroundColor Yellow
Push-Location client
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Client build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✅ Client build complete" -ForegroundColor Green

# Step 2: Start Server
Write-Host "`n🚀 Starting Server..." -ForegroundColor Yellow
Push-Location server
npm start
Pop-Location
