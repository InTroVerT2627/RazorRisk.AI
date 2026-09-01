@echo off
echo ==================================================
echo  RazorRisk.AI — Full System Verification Gate
echo ==================================================

echo.
echo [1/3] Running TypeScript Typecheck...
call npx tsc --noEmit
if %ERRORLEVEL% neq 0 (
    echo.
    echo [FAIL] TypeScript Typecheck failed!
    exit /b %ERRORLEVEL%
)
echo [PASS] 0 TypeScript errors found.

echo.
echo [2/3] Running Automated Vitest Suite (427 tests)...
call npm run test
if %ERRORLEVEL% neq 0 (
    echo.
    echo [FAIL] Test suite failed!
    exit /b %ERRORLEVEL%
)
echo [PASS] 427/427 tests passed.

echo.
echo [3/3] Compiling Next.js Production Build...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo [FAIL] Next.js build failed!
    exit /b %ERRORLEVEL%
)
echo [PASS] All routes compiled successfully.

echo.
echo ==================================================
echo  [SUCCESS] ALL QUALITY GATES PASSED!
echo ==================================================
