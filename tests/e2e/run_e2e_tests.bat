@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

title 绮管电商后台 - E2E自动化测试套件

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║        🚀 绮管电商后台 - E2E 自动化测试运行器              ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

set "SCRIPT_DIR=%~dp0"
set "RESULTS_DIR=%SCRIPT_DIR%results"
set "LOG_FILE=%SCRIPT_DIR%e2e_run.log"

if not exist "%RESULTS_DIR%" mkdir "%RESULTS_DIR%" >nul 2>&1

set "VERBOSE_MODE="
set "JSON_MODE="

:parse_args
if "%~1"=="--verbose" (
    set "VERBOSE_MODE=--verbose"
    shift
    goto parse_args
)
if "%~1"=="-v" (
    set "VERBOSE_MODE=--verbose"
    shift
    goto parse_args
)
if "%~1"=="--json" (
    set "JSON_MODE=--json"
    shift
    goto parse_args
)
if "%~1"=="-j" (
    set "JSON_MODE=--json"
    shift
    goto parse_args
)

set "START_TIME=%time%"
set "TOTAL_PASSED=0"
set "TOTAL_FAILED=0"
set "TOTAL_SKIPPED=0"
set "TOTAL_TESTS=0"
set "EXIT_CODE=0"
set "CRITICAL_ERRORS=0"
set "HIGH_ERRORS=0"

echo 📅 测试开始时间: %date% %time%
echo 📁 测试结果目录: %RESULTS_DIR%
echo.

call :log "=========================================="
call :log "E2E Test Run Started at %date% %time%"
call :log "=========================================="

REM ============================================================
REM  1. 页面测试 (test_pages.js)
REM ============================================================
echo.
echo ════════════════════════════════════════════════════════════
echo   [1/6] 🌐 页面可访问性测试 (test_pages.js)
echo ════════════════════════════════════════════════════════════
echo.

node "%SCRIPT_DIR%test_pages.js" %VERBOSE_MODE% %JSON_MODE%
set "PAGES_RESULT=%ERRORLEVEL%"

if %PAGES_RESULT% EQU 0 (
    echo.
    echo   ✅ 页面测试完成 - 通过
) else (
    echo.
    echo   ❌ 页面测试存在失败项
    set /a EXIT_CODE+=1
)

echo.
call :log "[1/6] Pages test completed with exit code: %PAGES_RESULT%"


REM ============================================================
REM  2. API接口测试 (test_apis.js)
REM ============================================================
echo.
echo ════════════════════════════════════════════════════════════
echo   [2/6] 🔌 API接口测试 (test_apis.js)
echo ════════════════════════════════════════════════════════════
echo.

node "%SCRIPT_DIR%test_apis.js" %VERBOSE_MODE% %JSON_MODE%
set "APIS_RESULT=%ERRORLEVEL%"

if %APIS_RESULT% EQU 0 (
    echo.
    echo   ✅ API测试完成 - 通过
) else (
    echo.
    echo   ❌ API测试存在失败项
    set /a EXIT_CODE+=1
)

echo.
call :log "[2/6] APIs test completed with exit code: %APIS_RESULT%"


REM ============================================================
REM  3. 功能完整性测试 (test_functionality.js)
REM ============================================================
echo.
echo ════════════════════════════════════════════════════════════
echo   [3/6] ⚙️ 功能完整性测试 (test_functionality.js)
echo ════════════════════════════════════════════════════════════
echo.

node "%SCRIPT_DIR%test_functionality.js" %VERBOSE_MODE% %JSON_MODE%
set "FUNC_RESULT=%ERRORLEVEL%"

if %FUNC_RESULT% EQU 0 (
    echo.
    echo   ✅ 功能测试完成 - 通过
) else (
    echo.
    echo   ❌ 功能测试存在失败项
    set /a EXIT_CODE+=1
)

echo.
call :log "[3/6] Functionality test completed with exit code: %FUNC_RESULT%"


REM ============================================================
REM  4. 性能监控测试 (test_performance.js)
REM ============================================================
echo.
echo ════════════════════════════════════════════════════════════
echo   [4/6] ⚡ 性能监控测试 (test_performance.js)
echo ════════════════════════════════════════════════════════════
echo.

node "%SCRIPT_DIR%test_performance.js" %VERBOSE_MODE% %JSON_MODE%
set "PERF_RESULT=%ERRORLEVEL%"

if %PERF_RESULT% EQU 0 (
    echo.
    echo   ✅ 性能测试完成 - 通过
) else (
    echo.
    echo   ⚠️  性能测试发现性能问题
    REM Performance issues are warnings, not critical failures
)

echo.
call :log "[4/6] Performance test completed with exit code: %PERF_RESULT%"


REM ============================================================
REM  5. 安全性扫描 (test_security.js)
REM ============================================================
echo.
echo ════════════════════════════════════════════════════════════
echo   [5/6] 🛡️ 安全性扫描 (test_security.js)
echo ════════════════════════════════════════════════════════════
echo.

node "%SCRIPT_DIR%test_security.js" %VERBOSE_MODE% %JSON_MODE%
set "SEC_RESULT=%ERRORLEVEL%"

if %SEC_RESULT% EQU 0 (
    echo.
    echo   ✅ 安全扫描通过 - 未发现严重问题
) else if %SEC_RESULT% EQU 1 (
    echo.
    echo   ⚠️  安全扫描发现问题 (High级别)
    set /a HIGH_ERRORS+=1
    set /a EXIT_CODE+=1
) else if %SEC_RESULT% GEQ 2 (
    echo.
    echo   🔴 安全扫描发现严重问题 (Critical级别)!
    set /a CRITICAL_ERRORS+=1
    set /a EXIT_CODE+=2
)

echo.
call :log "[5/6] Security scan completed with exit code: %SEC_RESULT%"


REM ============================================================
REM  6. 生成最终报告 (generate_final_report.js)
REM ============================================================
echo.
echo ════════════════════════════════════════════════════════════
echo   [6/6] 📋 生成最终测试报告
echo ════════════════════════════════════════════════════════════
echo.

node "%SCRIPT_DIR%generate_final_report.js"
set "REPORT_RESULT=%ERRORLEVEL%"

if %REPORT_RESULT% EQU 0 (
    echo.
    echo   ✅ 最终报告已成功生成
) else (
    echo.
    echo   ⚠️  报告生成完成(存在问题标记)
)

echo.
call :log "[6/6] Final report generated with exit code: %REPORT_RESULT%"


REM ============================================================
REM 汇总统计
REM ============================================================
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    📊 E2E测试执行汇总                       ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║  模块                    状态                               ║
echo ║  ─────────────────────────────────────────────────────────── ║

if %PAGES_RESULT% EQU 0 (
    echo ║  [1] 页面测试            ✅ 通过                         ║
) else (
    echo ║  [1] 页面测试            ❌ 失败                         ║
)

if %APIS_RESULT% EQU 0 (
    echo ║  [2] API接口测试         ✅ 通过                         ║
) else (
    echo ║  [2] API接口测试         ❌ 失败                         ║
)

if %FUNC_RESULT% EQU 0 (
    echo ║  [3] 功能完整性测试      ✅ 通过                         ║
) else (
    echo ║  [3] 功能完整性测试      ❌ 失败                         ║
)

if %PERF_RESULT% EQU 0 (
    echo ║  [4] 性能监控            ✅ 通过                         ║
) else (
    echo ║  [4] 性能监控            ⚠️  需关注                      ║
)

if %SEC_RESULT% EQU 0 (
    echo ║  [5] 安全性扫描          ✅ 通过                         ║
) else if %SEC_RESULT% EQU 1 (
    echo ║  [5] 安全性扫描          ⚠️  发现高危问题               ║
) else (
    echo ║  [5] 安全性扫描          🔴 发现严重问题                ║
)

echo ║  [6] 最终报告             ✅ 已生成                        ║
echo ║                                                              ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║  严重问题(Critical):     %CRITICAL_ERRORS%                                   ║
echo ║  高危问题(High):         %HIGH_ERRORS%                                   ║
echo ║  总体退出码:             %EXIT_CODE%                                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

set "END_TIME=%time%"
echo 🏁 测试结束时间: %date% %END_TIME%

call :log "=========================================="
call :log "E2E Test Run Completed at %date% %END_TIME%"
call :log "Exit Code: %EXIT_CODE%"
call :log "Critical Issues: %CRITICAL_ERRORS%, High Issues: %HIGH_ERRORS%"
call :log "=========================================="

if %CRITICAL_ERRORS% GTR 0 (
    echo.
    echo 🔴🔴🔴  存在严重安全问题! 请立即查看安全扫描报告!  🔴🔴🔴
    echo.
) else if %HIGH_ERRORS% GTR 0 (
    echo.
    echo ⚠️⚠️  存在高危问题需要处理，请查看详细报告  ⚠️⚠️
    echo.
) else if %EXIT_CODE% GTR 0 (
    echo.
    echo ⚠️  部分测试未通过，请查看详细报告了解详情
    echo.
) else (
    echo.
    echo 🎉🎉🎉  所有E2E测试通过! 系统状态良好!  🎉🎉🎉
    echo.
)

exit /b %EXIT_CODE%

goto :eof

:log
echo [%date% %time%] %* >> "%LOG_FILE%"
goto :eof
