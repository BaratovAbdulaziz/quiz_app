import asyncio
import logging

from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command

from .config import BOT_TOKEN
from .api import chat

logging.basicConfig(level=logging.INFO)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(
        "Hello! I'm the QuizFlow bot.\n\n"
        "Send me a topic and I'll generate quiz questions for you.\n"
        "Or ask me anything about your quizzes!"
    )

@dp.message()
async def handle_message(message: types.Message):
    if not message.text:
        return
    await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    try:
        reply = await chat(message.text, message.from_user.id)
        await message.answer(reply)
    except Exception as e:
        logging.error(f"Failed to get reply: {e}")
        await message.answer("Sorry, something went wrong. Please try again later.")

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
