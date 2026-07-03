import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
WEB_APP_URL: str = os.getenv("WEB_APP_URL", "http://localhost:3000")
