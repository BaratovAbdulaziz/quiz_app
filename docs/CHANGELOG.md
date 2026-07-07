# Changelog

## 2026-07-07 — Username System, Share Links Fixed, UX Improvements

- **Added username system**: New `username` column (unique, nullable) on users table with migration (`0003_gifted_blade`).
- **Settings API updated**: `PATCH /api/settings` accepts `username`, validates format (`[a-zA-Z0-9_]{3,20}`), checks uniqueness case-insensitively, returns 409 on conflict.
- **Check-username endpoint**: `POST /api/settings/check-username` returns `{ available: boolean }` for real-time availability checks.
- **Frontend username UI**: Settings page shows `@username`, editable input with Save button, inline validation, "Saved!" confirmation with auto-dismiss.
- **Share links now use `window.location.origin`**: Share URLs are dynamically constructed from the current origin instead of relying on `APP_URL` env var — works locally and in production without config.
- **Telegram login URL updated**: Changed from `@QuizAppBot` to `@Quiz_talaba_bot`.
- **Logo hover effect**: Added scale + green glow animation on hover.
- **Question count combobox**: Generate modal now uses `<input type="number" list="...">` instead of a plain `<select>` — users can type custom values or pick presets.
- **Added `"save"` and `"username"` i18n keys** to all three locales.
- **Fixed API error messages**: `api()` helper now surfaces the actual error message from the server.

## 2026-07-06 — Google Auth Fix, JSON Repair, DB Infrastructure

- **Fixed Google login**: Added `/api/auth/clerk` exchange endpoint that converts Clerk JWT to custom JWT, bypassing unreliable `clerkAuth()` in route handlers. User is created/upserted in local DB and gets our custom JWT for subsequent API calls.
- **Fixed aggressive sign-out**: Removed `clerkSignOut()` call when `fetchMe()` fails — user stays on login screen instead of being bounced.
- **Fixed non-existent JWT template**: Removed `template: "convex"` from `getClerkToken()` — was referencing a template that doesn't exist.
- **Added JSON repair for AI output**: New `repairJson()` function handles malformed JSON from AI models (trailing commas, single quotes, unquoted keys, unclosed braces). Applied to `parsePdfQuestions`, `generateQuizQuestions`, and `generateWithClarification`.
- **Started PostgreSQL in Docker**: DB was not running locally, causing all DB queries to fail. Added `postgres:16-alpine` container, pushed Drizzle schema.
- **Updated `DATABASE_URL`**: Added password to connection string for Docker PostgreSQL.
- **Started MinIO container**: Required for file storage (was already running).

## 2026-07-06 — Admin Panel Enhancements & Infrastructure

- Added `is_test_user` column (integer, default 0) to users table for filtering test accounts
- Admin panel now excludes test users from the user list
- Admin user list displays `tokens` as a separate field (mirrors credits value)
- Added **Test API** section in admin panel: input a topic, hit Test, and it calls `/api/ai/generate` and shows the result (question count, clarification, or error)
- Credit subtraction fully operational: AI generation (5 credits) and PDF parsing (5 credits) both deduct from user balance
- Migrated file storage from Cloudflare R2 to local MinIO container for development
- Added `forcePathStyle: true` to S3 client for MinIO compatibility
- Replaced `pdf-parse` npm package with `pdftotext` CLI for PDF text extraction
- Added `questionsPerQuiz` parameter to PDF parse route: splits extracted questions across multiple quizzes with numbered titles
- Added **Upload Modal** popup that shows before PDF processing: filename display, questions-per-test input, progress bar during upload + parse
- Fixed AI empty response handling: added `message.refusal` check, expanded `FREE_MODELS` array, retry logic cycles through different free models on failure
- Bumped `maxTokens` to 4000 for AI calls (was 2000)
- Added improved error detail for empty AI responses (includes `finish_reason` and raw message)
- Clerk middleware now auto-creates DB user from Clerk API when no matching DB row exists (fixes 401 / `cannot_render_single_session_enabled`)

## 2026-07-02 — Planning Q&A Update

- Changed authentication from email/Google to Telegram-only with auto-account creation.
- Replaced view-only sharing with copy-based sharing (import independent copy).
- Added AI credits system with 15-day refresh cycle.
- Added skip question support in both practice and exam modes.
- Added retry incorrect answers (practice mode only).
- Added restart quiz (always available).
- Added randomize quiz toggle.
- Added resume incomplete practice sessions.
- Added skipped questions list in exam results.
- Changed library view to tree-style list only (no card view).
- Default upload location set to root folder.
- Added AI follow-up clarification questions during quiz generation.
- Added three UI languages: English, Uzbek, Russian.
- Removed role/permission system — every user is an owner.
- Removed public quiz gallery from V1.1 (moved to V1.2).
- Removed email-based flows (registration, password reset, email verification).
- Recorded 8 new product decisions (D009–D015).

## 2026-07-02 — Project Initialization

- Created project documentation structure using the OKF approach.
- Defined project vision, MVP scope, and architecture.
- Established feature inventory, user flows, and screen documentation.
- Recorded initial product decisions in `DECISIONS.md`.
