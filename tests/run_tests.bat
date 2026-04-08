@echo off
chcp 936 >nul 2>&1
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "TESTS_DIR=%SCRIPT_DIR%"

set "TOTAL_SUITES=0"
set "PASSED_SUITES=0"
set "FAILED_SUITES=0"

echo.
echo ================================================================
echo   [TEST] Database Integration Test Runner (Windows)
echo   ================================================================
echo   Time: %date% %time%
echo   Project: %PROJECT_ROOT%
echo ================================================================
echo.

cd /d "%PROJECT_ROOT%"

if not exist "%TESTS_DIR%" (
    echo [ERROR] Test directory not found: %TESTS_DIR%
    exit /b 1
)

if not exist ".env" (
    echo [WARN] .env file not found, using default config
    echo.
)

echo [INFO] Test Plan:
echo   1. DB Connection Test (test_db_connection.js)
echo   2. DB Init Test (test_db_init.js)
echo   3. CRUD Operations Test (test_crud_operations.js)
echo   4. Connection Pool Test (test_connection_pool.js)
echo   5. Performance Benchmark (test_performance_benchmark.js)
echo   6. Data Integrity Test (test_data_integrity.js)
echo.

call :run_test "DB Connection" "test_db_connection.js"
call :check_result

call :run_test "DB Init" "test_db_init.js"
call :check_result

call :run_test "CRUD Ops" "test_crud_operations.js"
call :check_result

call :run_test "Conn Pool" "test_connection_pool.js"
call :check_result

call :run_test "Performance" "test_performance_benchmark.js"
call :check_result

call :run_test "Data Integrity" "test_data_integrity.js"
call :check_result

echo.
echo ================================================================
echo   [RESULT] Final Report
echo ================================================================
echo   Total Suites:  %TOTAL_SUITES%
echo   Passed:        %PASSED_SUITES%
echo   Failed:        %FAILED_SUITES%
echo.

if %FAILED_SUITES% gtr 0 (
    echo [FAIL] Some tests failed. Check output above for details.
    exit /b 1
) else (
    echo [PASS] All test suites passed!
    echo [INFO] Database integration tests completed successfully.
    exit /b 0
)

goto :eof

:run_test
set "SUITE_NAME=%~1"
set "SUITE_FILE=%~2"

echo --------------------------------------------------------
echo [RUN] %SUITE_NAME% (%SUITE_FILE%)
echo --------------------------------------------------------

pushd "%TESTS_DIR%"
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
