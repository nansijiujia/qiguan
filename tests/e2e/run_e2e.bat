@echo off
chcp 936 >nul 2>&1
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%..\.."
set "E2E_DIR=%SCRIPT_DIR%"

set "TOTAL_SUITES=0"
set "PASSED_SUITES=0"
set "FAILED_SUITES=0"

echo.
echo ================================================================
echo   [E2E] End-to-End Test Runner (Windows)
echo   ================================================================
echo   Time: %date% %time%
echo   Target: https://qimengzhiyue.cn
echo ================================================================
echo.

cd /d "%PROJECT_ROOT%"

if not exist "%E2E_DIR%" (
    echo [ERROR] E2E directory not found: %E2E_DIR%
    exit /b 1
)

echo [INFO] E2E Test Plan:
echo   1. Page Accessibility (test_pages.js)
echo   2. API Interface Test (test_apis.js)
echo   3. Functionality Test (test_functionality.js)
echo   4. Performance Monitor (test_performance.js)
echo   5. Security Scan (test_security.js)
echo.

call :run_test "Pages" "test_pages.js"
call :check_result

call :run_test "APIs" "test_apis.js"
call :check_result

call :run_test "Functionality" "test_functionality.js"
call :check_result

call :run_test "Performance" "test_performance.js"
call :check_result

call :run_test "Security" "test_security.js"
call :check_result

echo.
echo [INFO] Generating final report...
pushd "%E2E_DIR%"
node generate_final_report.js
popd

echo.
echo ================================================================
echo   [RESULT] E2E Final Report
echo ================================================================
echo   Total Suites:  %TOTAL_SUITES%
echo   Passed:        %PASSED_SUITES%
echo   Failed:        %FAILED_SUITES%
echo.

if %FAILED_SUITES% gtr 0 (
    echo [FAIL] Some E2E tests failed. Check output above.
    echo [INFO] Final report: %E2E_DIR%\E2E_FINAL_REPORT.md
    exit /b 1
) else (
    echo [PASS] All E2E test suites passed!
    echo [INFO] Final report generated: %E2E_DIR%\E2E_FINAL_REPORT.md
    exit /b 0
)

goto :eof

:run_test
set "SUITE_NAME=%~1"
set "SUITE_FILE=%~2"

echo --------------------------------------------------------
echo [RUN] %SUITE_NAME% (%SUITE_FILE%)
echo --------------------------------------------------------

pushd "%E2E_DIR%"
node "%SUITE_FILE%" %*
set "LAST_EXIT=!errorlevel!"
popd

if !LAST_EXIT! equ 0 (
    echo [OK] %SUITE_NAME% passed
) else (
    echo [FAIL] %SUITE_NAME% failed (code: !LAST_EXIT!)
)

exit /b !LAST_EXIT!

:check_result
if !LAST_EXIT! neq 0 (
    set /a FAILED_SUITES+=1
) else (
    set /a PASSED_SUITES+=1
)
set /a TOTAL_SUITES+=1
echo.

exit /b 0

:end
endlocal
