@echo off
chcp 65001 >nul
title 爆款内容智库 - 一键安装
echo.
echo   ╔═══════════════════════════════════════╗
echo   ║     爆款内容智库 · 一键安装向导       ║
echo   ╚═══════════════════════════════════════╝
echo.
echo   检查运行环境...

REM ---- Check Node.js ----
echo   [1/4] 检测 Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo   [错误] 未安装 Node.js！
    echo.
    echo   请先安装 Node.js:
    echo   1. 打开浏览器访问 https://nodejs.org
    echo   2. 下载左侧 LTS 版本（推荐 22.x）
    echo   3. 安装时全部默认选项，一路点 Next
    echo   4. 装完后重新运行本脚本
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo   已找到 Node.js %%v

REM ---- Check Python ----
echo   [2/4] 检测 Python...
where python >nul 2>nul
if %errorlevel% neq 0 (
    where python3 >nul 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo   [错误] 未安装 Python！
        echo.
        echo   请先安装 Python 3.10+:
        echo   1. 打开浏览器访问 https://www.python.org/downloads/
        echo   2. 下载最新版，安装时请勾选 "Add Python to PATH"
        echo   3. 装完后重新运行本脚本
        echo.
        pause
        exit /b 1
    )
    set PYTHON_CMD=python3
) else (
    set PYTHON_CMD=python
)

for /f "tokens=*" %%v in ('%PYTHON_CMD% --version') do echo   已找到 Python %%v

REM ---- Install Python Dependencies ----
echo   [3/4] 安装 Python 依赖库...
cd /d "%~dp0backend"
%PYTHON_CMD% -m venv venv 2>nul
call venv\Scripts\activate.bat && pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple -q
if %errorlevel% neq 0 (
    echo   [警告] Python 依赖安装异常，尝试安装核心依赖...
    pip install fastapi uvicorn sqlalchemy pydantic python-multipart aiofiles httpx jieba -i https://pypi.tuna.tsinghua.edu.cn/simple
)
echo   Python 依赖安装完成

REM ---- Install Node Dependencies ----
echo   [4/4] 安装前端依赖库...
cd /d "%~dp0frontend"
if not exist node_modules (
    call npm install --legacy-peer-deps
) else (
    echo   依赖目录已存在，跳过
)
echo   前端依赖安装完成

echo.
echo   ╔═══════════════════════════════════════╗
echo   ║           安装完成！                   ║
echo   ║                                       ║
echo   ║   以后直接双击 start.bat 启动           ║
echo   ║                                       ║
echo   ║   首次使用记得在"设置"页填 API Key      ║
echo   ╚═══════════════════════════════════════╝
echo.
pause
