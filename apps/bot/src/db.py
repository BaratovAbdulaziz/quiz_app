import asyncpg
from .config import DATABASE_URL

pool: asyncpg.Pool | None = None


async def create_pool():
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)


async def close_pool():
    global pool
    if pool:
        await pool.close()


async def get_pending_notifications():
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, user_id, message FROM notifications WHERE sent = false ORDER BY created_at ASC LIMIT 50"
        )
        return rows


async def mark_notification_sent(notification_id: int):
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE notifications SET sent = true, sent_at = NOW() WHERE id = $1",
            notification_id,
        )


async def get_user_telegram_id(user_id: str) -> int | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT telegram_id FROM users WHERE id = $1", user_id
        )
        return row["telegram_id"] if row else None
