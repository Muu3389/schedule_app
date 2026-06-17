import os

# VPS の公開 URL（末尾スラッシュなし）
BASE_URL = os.environ.get("BASE_URL", "https://your-domain.com")

LINE_CHANNEL_ID = os.environ.get("LINE_CHANNEL_ID", "")
LINE_CHANNEL_SECRET = os.environ.get("LINE_CHANNEL_SECRET", "")
REDIRECT_URL = f"{BASE_URL}/line_callback"

FLASK_SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "change-me-to-a-random-string")

LINE_BOT_CHANNEL_SECRET = os.environ.get("LINE_BOT_CHANNEL_SECRET", "")
LINE_BOT_CHANNEL_ACCESS_TOKEN = os.environ.get("LINE_BOT_CHANNEL_ACCESS_TOKEN", "")

# LINE 友だち追加 URL（Messaging API チャンネルのリンク）
LINE_ADD_FRIEND_URL = os.environ.get("LINE_ADD_FRIEND_URL", "https://lin.ee/your-link")
