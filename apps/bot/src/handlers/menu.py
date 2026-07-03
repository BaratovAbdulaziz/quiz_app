from aiogram import Router, types
from aiogram.types import WebAppInfo

router = Router()


@router.message(lambda message: message.text == "Open Quiz App")
async def open_app_handler(message: types.Message):
    await message.answer(
        "Opening Quiz App...",
        reply_markup=types.InlineKeyboardMarkup(
            inline_keyboard=[
                [types.InlineKeyboardButton(text="Open Quiz App", web_app=WebAppInfo(url="https://t.me/QuizAppBot/app"))]
            ]
        ),
    )
