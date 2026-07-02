# Tech Stack Overview

## Structure

Monorepo (Turborepo) containing two apps and shared packages in a single repository:

```
quiz_app/
├── apps/
│   ├── web/          # Next.js web application
│   └── bot/          # Telegram bot (Python)
├── packages/
│   └── shared/       # Shared TypeScript code (types, utils, db schema)
├── components/       # UI components
├── docs/             # Documentation
└── prompts/          # AI prompts
```

## Stack Summary

| Layer | Technology | Language |
|---|---|---|
| Web frontend | Next.js 15 (App Router) | TypeScript |
| Web backend | Next.js API routes | TypeScript |
| Database | Supabase (PostgreSQL) | SQL via Drizzle ORM |
| Storage | Cloudflare R2 (S3-compatible) | — |
| AI | OpenRouter (free models) | — |
| Telegram bot | aiogram 3.x | Python |
| UI | Tailwind CSS + shadcn/ui | TypeScript |
| Monorepo | Turborepo | — |
| Package manager | npm | — |

## Communication

- Web app queries Supabase (PostgreSQL) via Drizzle ORM.
- Telegram bot connects to the same Supabase database via an async PostgreSQL client.
- Bot sends notifications for news and test-imported events.
- Bot menu button opens the web app inside Telegram.
- AI calls go through OpenRouter, which routes to free/open models.
- PDF files stored in Cloudflare R2, served via signed URLs.

## Key Documents

- `WEB_APP.md` — web application details
- `TELEGRAM_BOT.md` — Telegram bot details
- `../ARCHITECTURE.md` — system architecture
- `../DATABASE.md` — shared data model
