import os
import requests
import config

def send_telegram_photo(image_bytes, caption):
    token = config.TELEGRAM_TOKEN
    chat_id = config.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        print("[Telegram] Chưa cấu hình TOKEN hoặc CHAT_ID, bỏ qua.")
        return False
        
    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    
    files = {"photo": ("alert.jpg", image_bytes, "image/jpeg")}
    data = {"chat_id": chat_id, "caption": caption}
    
    try:
        response = requests.post(url, data=data, files=files, timeout=20)
        response.raise_for_status()
        print("[Telegram] Gửi ảnh thành công.")
        return True
    except Exception as e:
        print(f"[Telegram] Lỗi gửi ảnh: {e}")
        return False

def send_telegram_video(video_path, caption):
    token = config.TELEGRAM_TOKEN
    chat_id = config.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        return False
        
    if not os.path.exists(video_path):
        print(f"[Telegram] File video không tồn tại: {video_path}")
        return False
        
    url = f"https://api.telegram.org/bot{token}/sendVideo"
    
    data = {"chat_id": chat_id, "caption": caption}
    
    try:
        with open(video_path, "rb") as video_file:
            files = {"video": video_file}
            response = requests.post(url, data=data, files=files, timeout=60)
            response.raise_for_status()
            print(f"[Telegram] Gửi video thành công: {os.path.basename(video_path)}")
            return True
    except Exception as e:
        print(f"[Telegram] Lỗi gửi video: {e}")
        return False
