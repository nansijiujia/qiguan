@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0"

set LOG_FILE=deploy_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%.log
set BRANCH=绮管
set REMOTE=origin
set TIMESTAMP=%date% %time%

echo ==========================================
echo [%TIMESTAMP%] 开始自动部署流程
echo 目标分支: %BRANCH%
echo 远程仓库: %REMOTE%
echo ========================================== >> "%LOG_FILE%"

git diff --quiet
if %errorlevel% neq 0 (
    echo [%TIMESTAMP%] 检测到更改，准备提交... >> "%LOG_FILE%"
    git add -A
    
    for /f "delims=" %%i in ('git diff --cached --name-only') do set CHANGED=%%i
    if not defined CHANGED (
        echo [%TIMESTAMP%] 没有需要提交的更改 >> "%LOG_FILE%"
        goto :end
    )
    
    set COMMIT_MSG=自动提交: %TIMESTAMP%
    git commit -m "!COMMIT_MSG!"
    echo [%TIMESTAMP%] 提交成功: !COMMIT_MSG! >> "%LOG_FILE%"
) else (
    echo [%TIMESTAMP%] 没有检测到更改，跳过提交步骤 >> "%LOG_FILE%"
)

echo [%TIMESTAMP%] 正在推送到 %REMOTE%/%BRANCH% ... >> "%LOG_FILE%"
git push %REMOTE% %BRANCH%

echo ========================================== >> "%LOG_FILE%"
echo [%TIMESTAMP%] ✅ 推送完成！ >> "%LOG_FILE%"
echo 日志文件: %LOG_FILE% >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

echo.
echo ✅ 推送完成！
echo 日志文件已保存到: %LOG_FILE%
pause

:end
endlocal
