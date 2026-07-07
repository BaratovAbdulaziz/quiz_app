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

**Prerequisites:** Node.js 20+, Docker, Python 3.12+

```bash
# Clone and install
git clone https://github.com/BaratovAbdulaziz/quiz_app.git
cd quiz_app
npm install

# Start local infra (Postgres + MinIO)
bash scripts/docker-up.sh

# Run database migrations
npm run migrate --workspace=@quiz-app/shared

# Start dev server
npm run dev
```

The web app runs at `http://localhost:3000`.

**Telegram bot** (optional, separate terminal):
```bash
cd apps/bot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m src.bot
```

## Railway Deployment

The project is configured to deploy on [Railway](https://railway.app). The `quiz-app-web` service auto-builds from the `main` branch.

### Environment Variables

Add these to the `quiz-app-web` service on Railway:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Railway Postgres reference (auto-injected) |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token |
| `R2_ENDPOINT` | S3 endpoint (Railway Bucket or Cloudflare R2) |
| `R2_ACCESS_KEY` | S3 access key |
| `R2_SECRET_KEY` | S3 secret key |
| `R2_BUCKET` | S3 bucket name |
| `APP_URL` | Public app URL (e.g. `https://quiz-app.up.railway.app`) |
| `NEXT_PUBLIC_API_URL` | Same as APP_URL |
| `OPENROUTER_API_KEYS` | Comma-separated OpenRouter API keys |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook secret |
| `CLERK_ISSUER_URL` | Clerk issuer URL |

Railway automatically sets `PORT` and provides reference variables for Postgres, Redis, and Bucket services.

### Deploy

Push to `main` — Railway auto-builds and deploys. No Docker Compose, PM2, Nginx, or SSL config needed.

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
