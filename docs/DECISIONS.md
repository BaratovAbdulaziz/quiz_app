# Decisions

## Decision Log

### D001: Single-Page Application with REST API

- **Decision:** Use a React SPA with a Node.js REST backend rather than a monolithic server-rendered app.
- **Reason:** Clean separation of concerns, easier to scale frontend and backend independently, simpler to add mobile apps later.
- **Date:** 2026-07-02
- **Status:** Approved

### D002: PostgreSQL as Primary Database

- **Decision:** Use PostgreSQL for all structured data.
- **Reason:** Reliable, well-supported, excellent JSON support for flexible question options, strong ecosystem.
- **Date:** 2026-07-02
- **Status:** Approved

### D003: OpenAI API for AI Processing

- **Decision:** Use OpenAI API for PDF parsing and quiz generation.
- **Reason:** Best-in-class text understanding and generation capabilities; reduces the need for custom ML infrastructure.
- **Date:** 2026-07-02
- **Status:** Approved

### D004: JWT with Refresh Token Rotation

- **Decision:** Use short-lived access tokens (15 min) with rotating refresh tokens.
- **Reason:** Balances security and user experience; reduces risk of token theft; refresh rotation limits window for stolen tokens.
- **Date:** 2026-07-02
- **Status:** Approved

### D005: Flat Documentation Structure

- **Decision:** Keep all documentation files in a single `docs/` directory without subdirectories.
- **Reason:** Simpler navigation, easier for AI to discover, reduces decision overhead about where to place new documents.
- **Date:** 2026-07-02
- **Status:** Approved

### D006: File-Explorer Library Metaphor

- **Decision:** Organize quizzes in a folder-based hierarchy similar to desktop file explorers.
- **Reason:** Familiar mental model for users; intuitive drag-and-drop organization; avoids complexity of tagging systems in MVP.
- **Date:** 2026-07-02
- **Status:** Approved

### D007: One Question at a Time in Practice Mode

- **Decision:** Practice mode shows one question at a time with no back navigation.
- **Reason:** Encourages deliberate answering; prevents users from relying on context from other questions; simulates real testing conditions.
- **Date:** 2026-07-02
- **Status:** Approved

### D008: No Go Back in Practice Mode

- **Decision:** Users cannot return to previously answered questions in practice mode.
- **Reason:** Mirrors real exam psychology; prevents answer changing based on later questions; reinforces learning by committing to answers.
- **Date:** 2026-07-02
- **Status:** Approved

### D009: Telegram-Only Authentication

- **Decision:** Use Telegram login as the sole authentication method.
- **Reason:** Zero registration friction — accounts are auto-created on first login. No email, password, or verification flows needed. Simplifies the entire auth system and reduces security surface area.
- **Date:** 2026-07-02
- **Status:** Approved

### D010: Copy-Based Sharing Instead of View-Only

- **Decision:** Shared quizzes are imported as independent copies rather than granting view-only access.
- **Reason:** Eliminates the need for a permission system (no roles, no editors/viewers). Recipients get full control of their copy. Simplifies the data model and UI.
- **Date:** 2026-07-02
- **Status:** Approved

### D011: AI Credits System with 15-Day Refresh

- **Decision:** AI operations consume credits that refresh every 15 days.
- **Reason:** Prevents abuse of the AI service while giving regular users predictable free access. Simpler than usage-based billing in MVP. Provides a foundation for future premium tiers.
- **Date:** 2026-07-02
- **Status:** Approved

### D012: Skip Button in Both Modes

- **Decision:** Both practice and exam modes include a skip button.
- **Reason:** Respects user agency — students may not know an answer and should not be forced to guess. In exam mode, skipped questions are listed separately for review.
- **Date:** 2026-07-02
- **Status:** Approved

### D013: Tree-List Library View Only

- **Decision:** The library uses a single tree-style list view with expandable folders, no card view.
- **Reason:** Simpler to implement and navigate. Familiar file-explorer metaphor. Reduces UI design complexity.
- **Date:** 2026-07-02
- **Status:** Approved

### D014: UI Languages — English, Uzbek, Russian

- **Decision:** Support three UI languages from MVP: English, Uzbek, Russian.
- **Reason:** Core user base speaks these languages. Quiz content always remains in its original language regardless of UI language.
- **Date:** 2026-07-02
- **Status:** Approved

### D015: No Roles or Permission System in MVP

- **Decision:** No editor/viewer roles. Every user is an owner of their own content.
- **Reason:** Dramatically simplifies the data model, API, and UI. The copy-based sharing model makes roles unnecessary. Can be added later if team features are introduced.
- **Date:** 2026-07-02
- **Status:** Approved

### D016: Supabase as Database Provider

- **Decision:** Use Supabase (managed PostgreSQL) for all structured data.
- **Reason:** PostgreSQL compatibility means Drizzle ORM works directly. Managed service reduces ops overhead. Built-in auth helpers are useful but not required. Schema is relational (joins, foreign keys), which PostgreSQL handles naturally. Portable — can migrate off Supabase to any PostgreSQL host.
- **Date:** 2026-07-02
- **Status:** Approved

### D017: Turborepo for Monorepo Management

- **Decision:** Use Turborepo to manage the monorepo with `apps/web` and `apps/bot`.
- **Reason:** Cached builds, parallel task execution, shared config, clean separation between web and bot apps.
- **Date:** 2026-07-02
- **Status:** Approved

### D018: Drizzle ORM for Database Access

- **Decision:** Use Drizzle ORM for type-safe database queries and migrations.
- **Reason:** Lightweight, SQL-like API, excellent TypeScript support, works directly with PostgreSQL/Supabase without heavy abstraction. Migrations are simple and version-controlled.
- **Date:** 2026-07-02
- **Status:** Approved

### D019: OpenRouter for AI Model Access

- **Decision:** Route all AI calls through OpenRouter instead of directly using OpenAI.
- **Reason:** Access to free/open models reduces cost during MVP. Not locked into a single provider. Can switch models (e.g. GPT-4o, Claude, open-source) without code changes. Same OpenAI-compatible API format.
- **Date:** 2026-07-02
- **Status:** Approved

### D020: Python + aiogram for Telegram Bot

- **Decision:** Write the Telegram bot in Python using aiogram 3.x.
- **Reason:** aiogram is the most modern async Python bot framework. Polling mode is simpler than webhooks. Python's async ecosystem (asyncpg, SQLAlchemy async) works well for database access. Separate language from the web app is fine since the bot is a standalone service.
- **Date:** 2026-07-02
- **Status:** Approved

### D021: Cloudflare R2 for File Storage

- **Decision:** Use Cloudflare R2 (S3-compatible) for PDF file storage.
- **Reason:** No egress fees, global edge network, S3-compatible API means existing patterns work, cost-effective for file serving.
- **Date:** 2026-07-02
- **Status:** Approved
