import asyncio
import logging
from aiogram import Bot, Dispatcher
from .config import BOT_TOKEN
from .db import create_pool, close_pool
from .handlers.start import router as start_router
from .handlers.menu import router as menu_router
from .notifications.sender import send_pending_notifications

logging.basicConfig(level=logging.INFO)

dp = Dispatcher()
dp.include_router(start_router)
dp.include_router(menu_router)


async def notification_loop(bot: Bot):
    while True:
        try:
            await send_pending_notifications(bot)
        except Exception as e:
            logging.error(f"Notification check failed: {e}")
        await asyncio.sleep(60)


async def main():
    if not BOT_TOKEN:
        logging.error("BOT_TOKEN is not set")
        return

    bot = Bot(token=BOT_TOKEN)
    await create_pool()

    asyncio.create_task(notification_loop(bot))

    try:
        await dp.start_polling(bot)
    finally:
        await close_pool()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
