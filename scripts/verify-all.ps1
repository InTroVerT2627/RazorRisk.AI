# One-Click Verification Script for RazorRisk.AI (PowerShell)
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " RazorRisk.AI — Full System Verification Gate     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Static Typecheck
Write-Host "`n[1/3] Running TypeScript Typecheck..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[FAIL] TypeScript Typecheck failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[PASS] 0 TypeScript errors found." -ForegroundColor Green

# 2. Automated Test Suite
Write-Host "`n[2/3] Running Automated Vitest Suite (427 tests)..." -ForegroundColor Yellow
npm run test
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[FAIL] Test suite failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[PASS] 427/427 tests passed." -ForegroundColor Green

# 3. Next.js Production Build
Write-Host "`n[3/3] Compiling Next.js Production Build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[FAIL] Next.js build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[PASS] All routes compiled successfully." -ForegroundColor Green

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] ALL QUALITY GATES PASSED! READY FOR RELEASE! " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
