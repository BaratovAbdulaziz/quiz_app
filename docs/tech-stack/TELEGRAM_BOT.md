# Telegram Bot

## Purpose

The bot handles two things:

1. **Notifications** — push updates to users (news, when a test is imported).
2. **Entry point** — the bot's menu button opens the web app.

The bot does **not** handle quiz-taking. All quiz interaction happens in the web app.

## Framework

Python with **aiogram 3.x** (async, modern Telegram Bot API framework).

## Update Mode

**Polling** — the bot polls Telegram for updates (no webhook required). Suitable for a VPS or background process.

## Folder Structure (planned)

```
apps/bot/
├── src/
│   ├── main.py
│   ├── handlers/
│   │   ├── start.py
│   │   └── menu.py
│   ├── notifications/
│   │   └── sender.py
│   ├── db.py          # Database connection
│   └── config.py
├── pyproject.toml
└── requirements.txt
```

## Features

### Menu Button

The bot provides a menu button that opens the web app via Telegram's Web App or deep link mechanism. This is the primary entry point for users.

### Notifications

| Event | Trigger | Message |
|---|---|---|
| News/updates | Admin broadcast | Informational message from the platform |
| Test imported | AI finishes parsing a PDF | "Your quiz [title] is ready. Open in app." |

Notifications are sent via the Bot API. Users must have started the bot to receive them.

## Shared Resources

- Connects to the same **Supabase (PostgreSQL)** database as the web app.
- Uses an async PostgreSQL client (`asyncpg` or `SQLAlchemy async`).
- No direct AI calls — the bot only reads/writes to the database and sends Telegram messages.
