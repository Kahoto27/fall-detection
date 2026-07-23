@echo off
chcp 65001 > nul
title GuardFall — Start Ngrok (Internet Access)
cd /d D:\Projects\Fall-detection_anti
echo Đang khởi động Ngrok để kết nối Internet...
ngrok.exe http 5000
pause
