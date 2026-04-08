@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "TESTS_DIR=%SCRIPT_DIR%"

set "TOTAL_SUITES=0"
set "PASSED_SUITES=0"
set "FAILED_SUITES=0"
set "TOTAL_TESTS=0"
set "TOTAL_PASSED=0"
set "TOTAL_FAILED=0"
set "TOTAL_WARNINGS=0"

echo.
echo ════════════════════════════════════════════════════════════════
echo   🧪 电商后台系统 - 数据库集成测试运行器 (Windows)
echo   ════════════════════════════════════════════════════════════════
echo   运行时间: %date% %time%
echo   项目目录: %PROJECT_ROOT%
echo ════════════════════════════════════════════════════════════════
echo.

cd /d "%PROJECT_ROOT%"

if not exist "%TESTS_DIR%" (
    echo ❌ 错误: 测试目录不存在: %TESTS_DIR%
    exit /b 1
)

if not exist ".env" (
    echo ⚠️  警告: 未找到 .env 文件，使用默认数据库配置
    echo.
)

set "PARSE_JSON=0"
for %%a in (%*) do (
    if "%%a"=="--json" set "PARSE_JSON=1"
)

if "%PARSE_JSON%"=="1" (
    echo {"suite":"all-tests","timestamp":"%date% %time%","results":[}
) else (
    echo 📋 测试计划:
    echo    1. 数据库连接测试 (test_db_connection.js)
    echo    2. 数据库初始化验证 (test_db_init.js)
    echo    3. CRUD操作测试 (test_crud_operations.js)
    echo    4. 连接池压力测试 (test_connection_pool.js)
    echo    5. 性能基准测试 (test_performance_benchmark.js)
    echo    6. 数据完整性验证 (test_data_integrity.js)
    echo.
)

set "SUITE_START_TIME=%time%"

call :run_test_suite "数据库连接测试" "test_db_connection.js" %*
if !ERRORLEVEL! neq 0 (
    if "!LAST_EXIT!"=="1" (
        set /a FAILED_SUITES+=1
    ) else (
        set /a PASSED_SUITES+=1
    )
) else (
    set /a PASSED_SUITES+=1
)
set /a TOTAL_SUITES+=1
echo.

call :run_test_suite "数据库初始化验证" "test_db_init.js" %*
if !ERRORLEVEL! neq 0 (
    if "!LAST_EXIT!"=="1" (
        set /a FAILED_SUITES+=1
    ) else (
        set /a PASSED_SUITES+=1
    )
) else (
    set /a PASSED_SUITES+=1
)
set /a TOTAL_SUITES+=1
echo.

call :run_test_suite "CRUD操作测试" "test_crud_operations.js" %*
if !ERRORLEVEL! neq 0 (
    if "!LAST_EXIT!"=="1" (
        set /a FAILED_SUITES+=1
    ) else (
        set /a PASSED_SUITES+=1
    )
) else (
    set /a PASSED_SUITES+=1
)
set /a TOTAL_SUITES+=1
echo.

call :run_test_suite "连接池压力测试" "test_connection_pool.js" %*
if !ERRORLEVEL! neq 0 (
    if "!LAST_EXIT!"=="1" (
        set /a FAILED_SUITES+=1
    ) else (
        set /a PASSED_SUITES+=1
    )
) else (
    set /a PASSED_SUITES+=1
)
set /a TOTAL_SUITES+=1
echo.

call :run_test_suite "性能基准测试" "test_performance_benchmark.js" %*
if !ERRORLEVEL! neq 0 (
    if "!LAST_EXIT!"=="1" (
        set /a FAILED_SUITES+=1
    ) else (
        set /a PASSED_SUITES+=1
    )
) else (
    set /a PASSED_SUITES+=1
)
set /a TOTAL_SUITES+=1
echo.

call :run_test_suite "数据完整性验证" "test_data_integrity.js" %*
if !ERRORLEVEL! neq 0 (
    if "!LAST_EXIT!"=="1" (
        set /a FAILED_SUITES+=1
    ) else (
        set /a PASSED_SUITES+=1
    )
) else (
    set /a PASSED_SUITES+=1
)
set /a TOTAL_SUITES+=1
echo.

set "SUITE_END_TIME=%time%"

if "%PARSE_JSON%"=="1" (
    echo ]}
) else (
    echo ════════════════════════════════════════════════════════════════
    echo   📊 总体测试报告
    echo ════════════════════════════════════════════════════════════════
    echo.
    echo    测试套件总数: %TOTAL_SUITES%
    echo    ✅ 通过套件:   %PASSED_SUITES%
    echo    ❌ 失败套件:   %FAILED_SUITES%
    echo.
    echo    通过率:       %PASSED_SUITES%/%TOTAL_SUITES%
    echo.

    if %FAILED_SUITES% gtr 0 (
        echo   ❌ 存在失败的测试套件，请检查上方详细输出
        echo      建议运行: run_all_tests.bat --verbose 查看详细信息
        echo.
        exit /b 1
    ) else (
        echo   🎉 所有测试套件全部通过！
        echo   ✅ 数据库集成测试完成，系统可以正常部署。
        echo.
        exit /b 0
    )

    echo ════════════════════════════════════════════════════════════════
    echo.
)

goto :eof

:run_test_suite
set "SUITE_NAME=%~1"
set "SUITE_FILE=%~2"
shift
shift

echo ────────────────────────────────────────────────────────────────
echo   ▶️ 运行: %SUITE_NAME%
echo   文件: %SUITE_FILE%
echo ────────────────────────────────────────────────────────────────
echo.

pushd "%TESTS_DIR%"
node "%SUITE_FILE%" %*
set "LAST_EXIT=!errorlevel!"
popd

if %LAST_EXIT% equ 0 (
    echo.
    echo   ✅ %SUITE_NAME% 完成
) else (
    echo.
    echo   ❌ %SUITE_NAME% 失败 (退出码: %LAST_EXIT%)
)

exit /b %LAST_EXIT%

:end
endlocal
