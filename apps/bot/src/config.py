import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
API_BASE_URL: str = os.getenv("API_BASE_URL", "http://localhost:3000")
