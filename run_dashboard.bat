@echo off
cd /d D:\Projects\Fall-detection_anti
if not exist .next\BUILD_ID (
    echo Dang Build du an khoang 1 phut...
    call pnpm build
)
echo Khong tim thay loi, dang khoi dong server...
call pnpm start
pause
