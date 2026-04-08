@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo 🔧 绮管后台 - 一键修复部署脚本 (Windows版)
echo 时间: %date% %time%
echo ==========================================
echo.

set PROJECT_DIR=C:\www\qiguan  :: 修改为你的实际路径
set BACKEND_DIR=%PROJECT_DIR%
set FRONTEND_DIR=%PROJECT_DIR%\qiguanqianduan

:: ==================== 步骤1: 备份 ====================
echo 📦 步骤1/7: 备份当前数据...
if exist "%BACKEND_DIR%\data" (
    xcopy "%BACKEND_DIR%\data" "%BACKEND_DIR%\data_backup_%date:~0,4%%date:~5,2%%date:~8,2%\" /E /I /Y >nul
    echo [✓] 数据备份完成
) else (
    echo [!] 未找到数据目录，跳过备份
)
echo.

:: ==================== 步骤2: 拉取代码 ====================
echo 📥 步骤2/7: 拉取最新代码...
cd /d "%BACKEND_DIR%"
git pull origin 绮管
echo [✓] 代码拉取完成
echo.

:: ==================== 步骤3: 配置环境变量 ====================
echo ⚙️  步骤3/7: 配置环境变量...
cd /d "%BACKEND_DIR%"

(
echo # ============================================================
echo # 绮管电商后台 - 生产环境配置（自动生成）
echo # ============================================================
echo.
echo PORT=3000
echo NODE_ENV=production
echo DEBUG=false
echo.
echo DB_TYPE=mysql
echo DB_HOST=10.0.0.16
echo DB_PORT=3306
echo DB_USER=QMZYXCX
echo DB_PASSWORD=LJN040821.
echo DB_NAME=qmzyxcx
echo DB_CHARSET=utf8mb4
echo DB_TIMEZONE=+08:00
echo.
echo JWT_SECRET=qiguan-production-secret-key-2026-change-me
echo JWT_EXPIRES_IN=24h
echo.
echo CORS_ORIGIN=*
echo TRUST_PROXY=true
echo.
echo USE_MOCK_DATA=false
) > .env

echo [✓] 环境变量配置完成（已设置DB_TYPE=mysql）
echo.

:: ==================== 步骤4: 初始化数据库 ====================
echo 🗄️  步骤4/7: 初始化MySQL数据库...
cd /d "%BACKEND_DIR%"
if exist "scripts\init_mysql_database.js" (
    node scripts\init_mysql_database.js
    if !errorlevel! equ 0 (
        echo [!] MySQL初始化失败，切换到SQLite...
        powershell -Command "(Get-Content .env) -replace 'DB_TYPE=mysql', 'DB_TYPE=sqlite' | Set-Content .env"
    )
) else (
    echo [!] 未找到初始化脚本，跳过
)
echo.

:: ==================== 步骤5: 安装后端依赖 ====================
echo 📦 步骤5/7: 安装依赖...
cd /d "%BACKEND_DIR%"
npm install --production
echo [✓] 后端依赖安装完成
echo.

:: ==================== 步骤6: 构建前端 ====================
echo 🎨 步骤6/7: 构建前端项目...
cd /d "%FRONTEND_DIR%"
npm install
npm run build
if !errorlevel! neq 0 (
    echo [✗] 前端构建失败！
    pause
    exit /b 1
)
echo [✓] 前端构建成功
echo.

:: ==================== 步骤7: 重启服务 ====================
echo 🔄 步骤7/7: 重启服务...
cd /d "%BACKEND_DIR%"
pm2 restart qiguan-backend || pm2 start index.js --name qiguan-backend
echo [✓] 服务重启完成
timeout /t 3 >nul
pm2 status
pm2 logs qiguan-backend --lines 20 --nostream
echo.

echo ==========================================
echo 🎊 部署完成!
echo ==========================================
echo.
echo 📋 验证步骤:
echo   1. 访问 https://qimengzhiyue.cn/dashboard
echo   2. 确认仪表盘不再显示假数据
echo   3. 测试添加分类功能
echo.
pause
