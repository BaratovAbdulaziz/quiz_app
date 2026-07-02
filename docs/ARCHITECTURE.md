# Architecture

## High-Level Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend    │────▶│  Database   │
│  (React)    │     │  (Node.js)   │     │ (PostgreSQL)│
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌─────────────┐
                    │  AI Service  │     │   Storage   │
                    │  (OpenAI)    │     │  (S3-compat)│
                    └──────────────┘     └─────────────┘
```

## Frontend

- Single-page application built with React.
- Responsive design (mobile-first).
- Communicates with backend via REST API.
- Hosted on a CDN.

## Backend

- Node.js REST API server.
- Handles authentication, quiz management, library operations.
- Orchestrates AI service calls.
- Serves the API documented in `API.md`.

## AI Service

- Serverless function or dedicated service.
- Processes PDF text extraction, question parsing, and quiz generation.
- Communicates with OpenAI API.
- Validates and structures AI output before returning to backend.

## Database

- PostgreSQL for all structured data.
- Schema documented in `DATABASE.md`.

## Storage

- S3-compatible object storage for PDF files.
- Files are private by default; access-controlled via the backend.

## Authentication

- JWT-based authentication with refresh token rotation.
- Telegram login widget for authentication.
- Detailed in `AUTHENTICATION.md`.

## External Dependencies

- OpenAI API (AI processing)
- Telegram Bot API (authentication)
- S3-compatible storage provider
- CDN provider
