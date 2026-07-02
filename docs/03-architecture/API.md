# API

## Overview

RESTful API over HTTPS. All endpoints return JSON. Authentication is via JWT bearer token.

## Base URL

```
/api/v1
```

## Authentication

All endpoints except `/auth/*` require a Bearer token in the `Authorization` header.

```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | /auth/telegram | Telegram login / auto-register |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/logout | Invalidate refresh token |

### Library

| Method | Path | Description |
|---|---|---|
| GET | /library | List folders and quizzes |
| POST | /folders | Create folder |
| PATCH | /folders/:id | Rename folder |
| DELETE | /folders/:id | Delete folder and contents |
| PATCH | /quizzes/:id | Update quiz metadata |
| DELETE | /quizzes/:id | Delete quiz |

### Quizzes

| Method | Path | Description |
|---|---|---|
| GET | /quizzes/:id | Get quiz with questions |
| POST | /quizzes/:id/sessions | Start a quiz session |
| POST | /sessions/:id/answer | Submit an answer |
| POST | /sessions/:id/skip | Skip a question |
| POST | /sessions/:id/complete | Complete a session |
| GET | /sessions/:id | Get session results |
| POST | /quizzes/:id/restart | Restart quiz |

### Files

| Method | Path | Description |
|---|---|---|
| POST | /files/upload | Upload PDF |
| GET | /files/:id | Get file metadata |

### AI

| Method | Path | Description |
|---|---|---|
| POST | /ai/parse | Parse uploaded PDF into quiz |
| POST | /ai/generate | Generate quiz from topic |
| GET | /ai/credits | Get credit balance and refresh date |

### Sharing

| Method | Path | Description |
|---|---|---|
| POST | /quizzes/:id/share | Create share link |
| DELETE | /shares/:id | Revoke share link |
| GET | /shared/:token | Get shared quiz info (no auth) |
| POST | /shared/:token/import | Import shared quiz copy |

### Reports

| Method | Path | Description |
|---|---|---|
| POST | /questions/:id/report | Report a question to the owner |
| GET | /reports | List reports received (owner) |

### Settings

| Method | Path | Description |
|---|---|---|
| GET | /settings | Get user settings |
| PATCH | /settings | Update user settings |
| DELETE | /account | Delete account |

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
- Rate limit headers are included in responses.
