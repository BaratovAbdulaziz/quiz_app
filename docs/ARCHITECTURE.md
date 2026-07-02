# Architecture

## High-Level Overview

```
                    ┌─────────────────────┐
                    │   Telegram Bot      │
                    │   (Python/aiogram)  │
                    └────────┬────────────┘
                             │ polling
                             ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Browser    │────▶│  Next.js App │────▶│    Supabase      │
│  (React SPA) │     │  (API routes)│     │  (PostgreSQL)    │
└──────────────┘     └──────┬───────┘     └──────────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌──────────────────┐
                    │  OpenRouter  │     │  Cloudflare R2   │
                    │  (AI models) │     │  (File storage)  │
                    └──────────────┘     └──────────────────┘
```

## Frontend

- Next.js 15 with App Router, React 19.
- Responsive design, mobile-first.
- Communicates with backend via API routes and server actions.

## Backend

- Next.js API routes.
- Handles authentication, quiz management, library operations.
- Orchestrates AI calls through OpenRouter.
- File upload/download via Cloudflare R2.

## AI Service

- Calls made through OpenRouter API, which routes to free/open AI models.
- Handles PDF text extraction, question parsing, and quiz generation.
- Validates and structures AI output before storing.

## Database

- Supabase (managed PostgreSQL).
- Drizzle ORM for type-safe queries and migrations.
- Schema documented in `DATABASE.md`.

## Storage

- Cloudflare R2 (S3-compatible) for PDF files.
- Files are private; accessed via signed URLs.

## Authentication

- JWT-based with refresh token rotation.
- Telegram login widget.
- Detailed in `AUTHENTICATION.md`.

## Telegram Bot

- Python + aiogram 3.x.
- Polling mode (no webhook).
- Notifications only + menu button entry point.
- Shared database with the web app.

## External Dependencies

- OpenRouter API (AI processing)
- Supabase (database)
- Cloudflare R2 (file storage)
- Telegram Bot API (authentication, notifications)
