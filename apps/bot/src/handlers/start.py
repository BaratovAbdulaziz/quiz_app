from aiogram import Router, types
from aiogram.types import MenuButtonWebApp, WebAppInfo
from ..config import WEB_APP_URL

router = Router()


@router.message(commands=["start"])
async def start_handler(message: types.Message):
    await message.answer(
        "Welcome to Quiz App!\n\n"
        "Upload PDFs or enter a topic. Generate quizzes. Practice and master any subject.\n\n"
        "Tap the button below to open the app.",
        reply_markup=types.ReplyKeyboardMarkup(
            keyboard=[
                [types.KeyboardButton(text="Open Quiz App", web_app=WebAppInfo(url=WEB_APP_URL))]
            ],
            resize_keyboard=True,
        ),
    )

    await message.bot.set_chat_menu_button(
        chat_id=message.chat.id,
        menu_button=MenuButtonWebApp(text="Open Quiz App", web_app=WebAppInfo(url=WEB_APP_URL)),
    )
