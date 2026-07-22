@echo off
chcp 65001 >nul
echo ============================================
echo   爆款内容智库 - 启动脚本
echo ============================================
echo.

echo 清理旧进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak >nul

echo [1/2] 启动后端服务 (port 8000)...
start "内容智库-后端" cmd /c "cd /d %~dp0backend && C:\Users\admin02\.workbuddy\binaries\python\envs\content-hub\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] 启动前端服务 (port 5173)...
start "内容智库-前端" cmd /c "cd /d %~dp0frontend && npx vite --host 0.0.0.0 --port 5173"

echo.
echo ============================================
echo   启动完成！
echo.
echo   本机访问:     http://localhost:5173
echo   局域网访问:   http://你的IP:5173
echo   后端健康检查: http://localhost:8000/api/health
echo ============================================
echo.
pause
