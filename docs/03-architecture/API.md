# API

## Overview

RESTful API over HTTPS. All endpoints return JSON. Authentication is via JWT bearer token or Clerk session.

## Auth Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/telegram` | Telegram login / auto-register |
| POST | `/auth/clerk` | Exchange Clerk JWT for custom app JWT |
| POST | `/auth/dev-login` | Dev-only: create random test user |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |

Clerk Google OAuth: Clerk middleware protects routes; `/auth/clerk` exchanges a Clerk JWT for the app's custom JWT.

## API Routes

### Library

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/library` | List folders and quizzes |
| POST | `/api/folders` | Create folder |
| PATCH | `/api/folders` | Rename folder |
| DELETE | `/api/folders?id=...` | Delete folder and contents |
| PATCH | `/api/quizzes` | Update quiz metadata (rename, move to folder) |
| DELETE | `/api/quizzes?id=...` | Delete quiz |

### Quizzes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/quizzes` | List quizzes |
| GET | `/api/quizzes/{id}` | Get quiz with questions |
| POST | `/api/quizzes` | Create quiz |
| POST | `/api/sessions` | Start a quiz session |
| POST | `/api/sessions/{id}/answer` | Submit an answer |
| POST | `/api/sessions/{id}/skip` | Skip a question |
| POST | `/api/sessions/{id}/complete` | Complete a session |
| GET | `/api/sessions/{id}` | Get session results |
| POST | `/api/quizzes/{id}/restart` | Restart quiz |

### Files

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/files/upload` | Upload PDF (to MinIO/R2) |
| GET | `/api/files/{id}` | Get file metadata |

### AI

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/parse` | Parse uploaded PDF into quiz(es) — supports `questionsPerQuiz` param |
| POST | `/api/ai/generate` | Generate quiz from topic (supports `folderId`, `clarificationAnswer`) |
| GET | `/api/ai/credits` | Get credit balance and refresh date |

### Sharing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/quizzes/{id}/share` | Create share link |
| DELETE | `/api/shares/{id}` | Revoke share link |
| GET | `/api/shared/{token}` | Get shared quiz info (no auth) |
| POST | `/api/shared/{token}/import` | Import shared quiz copy |

### Reports

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reports` | Report a question |
| GET | `/api/reports` | List reports received |

### Settings / Account

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | Get current user (used by Telegram auth) |
| GET | `/api/settings` | Get user settings (returns `username`, `displayName`, `language`, `credits`) |
| PATCH | `/api/settings` | Update user settings (accepts `username`, `displayName`, `language`) |
| POST | `/api/settings/check-username` | Check username availability (`{ username: string }` → `{ available: boolean }`) |
| DELETE | `/api/account` | Delete account |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users?password=...` | List non-test users with tokens |
| POST | `/api/admin/users` | Add credits (`{ password, userId, credits }`) |
| GET | `/api/admin/bot` | Check bot status |
| POST | `/api/admin/bot` | Start/stop bot |
| GET | `/api/admin/config` | Read `.env` values |
| POST | `/api/admin/config` | Write `.env` values |
| POST | `/api/admin/kill` | Kill site |

## Response Format

### Success

```json
{
  "data": { ... }
}
```

### Error

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found."
  }
}
```

## Pagination

List endpoints support pagination via `page` and `per_page` query parameters.

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

## Rate Limiting

- Authenticated: 100 requests per minute.
- Unauthenticated: 20 requests per minute.
- AI endpoints: 10 requests per minute.
