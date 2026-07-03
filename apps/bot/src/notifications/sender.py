from aiogram import Bot
from ..db import get_pending_notifications, mark_notification_sent, get_user_telegram_id


async def send_pending_notifications(bot: Bot):
    notifications = await get_pending_notifications()

    for notif in notifications:
        telegram_id = await get_user_telegram_id(notif["user_id"])
        if telegram_id is None:
            continue

        try:
            await bot.send_message(
                chat_id=telegram_id,
                text=notif["message"],
            )
            await mark_notification_sent(notif["id"])
        except Exception:
            continue
