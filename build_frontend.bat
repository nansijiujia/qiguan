@echo off

REM 进入前端目录
cd qiguanqianduan

REM 安装依赖
npm install

REM 构建前端
npm run build

REM 回到根目录
cd ..

REM 删除旧的dist目录
if exist dist rmdir /s /q dist

REM 创建新的dist目录
mkdir dist

REM 复制前端构建产物
xcopy qiguanqianduan\dist dist /E /I /Q

echo 构建完成！