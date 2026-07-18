# QuizFlow

AI-powered study platform that transforms static PDFs and topics into interactive practice quizzes.

Students upload multiple-choice question PDFs or enter a topic, and the system uses AI to generate structured quizzes. Practice with immediate feedback or simulate timed exams. All quizzes are saved in a personal library organized like a file explorer.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui |
| Backend | Next.js API routes |
| Database | PostgreSQL (via Drizzle ORM) |
| Auth | Clerk (Google OAuth) + Telegram login + custom JWT |
| AI | OpenRouter (Llama, Qwen, etc.) |
| Storage | S3-compatible (Cloudflare R2 / MinIO) |
| Bot | Python aiogram 3.x Telegram bot |
| Monorepo | Turborepo + npm workspaces |

## Local Development

**Prerequisites:** Docker

```bash
# Clone
git clone https://github.com/BaratovAbdulaziz/quiz_app.git
cd quiz_app

# Set env vars (copy and fill in your keys)
cp .env.example .env

# Start everything (Postgres + MinIO + app)
docker compose up -d

# App runs at http://localhost:3000
# Postgres on :5432, MinIO console on :9001
```

Migrations run automatically on first start. No Node.js, Python, or manual setup needed.

### Configuration via Admin Panel

1. Open `http://localhost:3000` → admin panel
2. Click **Export Config** — copies all env vars to clipboard as JSON
3. Paste this JSON into your Railway deployment's admin panel to transfer all settings

## Railway Deployment

Push to `main` — Railway auto-builds and deploys. No Docker Compose, PM2, Nginx, or SSL config needed.

### Quick Setup

1. Deploy to Railway (auto-builds from `main`)
2. Add a Postgres plugin — `DATABASE_URL` is injected automatically
3. Open the app → admin panel → **Import Config**
4. Paste the JSON exported from your local Docker setup
5. All env vars are configured — done

## Project Structure

```
apps/
  web/          # Next.js web application
  bot/          # Python Telegram bot
packages/
  shared/       # Shared DB schema, types, migrations
scripts/        # Local dev helper scripts
docs/           # Full project specification
```

## Key Docs

- [`docs/`](docs/) — Complete project specification
- [`docs/ADMIN.md`](docs/ADMIN.md) — Admin panel guide

## License

Private — all rights reserved.
