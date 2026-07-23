@echo off
title GuardFall - Dung He Thong An Toan

echo.
echo  ======================================================
echo     GuardFall - TAT VA DON DEP HE THONG AN TOAN
echo  ======================================================
echo.

echo  [1/3] Dang quet va tat cac luong Python Server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| find "LISTENING"') do taskkill /F /PID %%a > nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765" ^| find "LISTENING"') do taskkill /F /PID %%a > nul 2>&1

echo  [2/3] Dang quet va tat giao dien Web Next.js...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| find "LISTENING"') do taskkill /F /PID %%a > nul 2>&1

echo  [3/3] Dang tat Node.js (Next.js Dashboard)...
taskkill /f /im node.exe > nul 2>&1

echo Dang tat Mosquitto MQTT Broker...
taskkill /F /IM mosquitto.exe > nul 2>&1

echo.
echo  [XONG] Da tieu diet toan bo tien trinh bong ma.
echo  He thong cua ban da duoc tra ve trang thai sach 100%%.
echo.
pause
