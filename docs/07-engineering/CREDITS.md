# Credits / Tokens

## Credit System

- Each user starts with **100 credits** upon account creation
- Credits refresh every **15 days** (`creditsRefreshAt` set to `now() + 15 days`)
- Credits are displayed as **Tokens** in the admin panel

## Costs

| Action | Cost |
|--------|------|
| AI quiz generation from topic | 5 credits |
| AI PDF parsing into quiz | 5 credits |

## Credit Check

Both AI endpoints check the user's credit balance before processing:
- `GET /api/ai/credits` — returns `{ balance, refreshAt }`
- Insufficient credits returns HTTP 403 with `INSUFFICIENT_CREDITS` error

## Admin Management

Admins can add credits to any user via the admin panel or `POST /api/admin/users`.

## Third-Party Services

- **AI provider** — OpenRouter (free model routing)
- **Database** — Supabase (managed PostgreSQL)
- **File storage** — MinIO (local S3-compatible, dev) / Cloudflare R2 (production)
- **Authentication** — Clerk (Google OAuth), Telegram Bot API (JWT)
- **Bot hosting** — PM2 on VPS

## Open Source Libraries

### Web App

- Next.js 15, React 19, TypeScript
- Tailwind CSS
- Drizzle ORM
- lucide-react
- Clerk (@clerk/nextjs)

### Telegram Bot

- Python, aiogram 3.x
- asyncpg / SQLAlchemy

## Icons and Assets

(To be populated as design assets are finalized.)
