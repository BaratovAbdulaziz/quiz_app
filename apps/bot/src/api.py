import httpx
from .config import API_BASE_URL

async def chat(message: str, telegram_id: int) -> str:
    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=30) as client:
        res = await client.post("/api/bot/chat", json={
            "message": message,
            "telegram_id": telegram_id,
        })
        res.raise_for_status()
        data = res.json()
        return data.get("data", {}).get("reply", "Sorry, I couldn't process that.")
