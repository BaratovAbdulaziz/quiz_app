# Web App

## Framework

Next.js 15 with App Router, written in TypeScript.

## Frontend

- React 19 with server and client components.
- Tailwind CSS for styling.
- shadcn/ui for component primitives (button, card, carousel, etc.).
- Custom components in `components/ui/`.

## Backend

- Next.js API routes handle all server-side logic.
- Authentication via Telegram login widget.
- AI calls via OpenRouter (free model routing).
- File storage in Cloudflare R2 (S3-compatible).
- Supabase for database and authentication helpers.

## Database

- Supabase (managed PostgreSQL).
- Drizzle ORM for type-safe queries and migrations.
- Schema documented in `docs/DATABASE.md`.

## Folder Structure (planned)

```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── library/
│   ├── quiz/
│   └── settings/
├── components/
├── lib/
│   ├── db.ts          # Drizzle client
│   ├── openrouter.ts   # AI client
│   └── r2.ts           # Storage client
└── public/
```

## Entry Point

The bot's menu button opens the web app. Users who log in via Telegram are directed to their library.
