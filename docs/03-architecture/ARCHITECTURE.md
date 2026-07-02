# Architecture

## System Overview

```
                         ┌──────────────────────────────────┐
                         │          Telegram                │
                         │  (User opens bot → menu button)  │
                         └────────┬──────────────┬──────────┘
                                  │              │
                          polling │              │ Telegram Web App
                                  ▼              ▼
                     ┌──────────────────┐  ┌──────────────────┐
                     │  Telegram Bot    │  │    Browser       │
                     │  (Python/        │  │  (React SPA in   │
                     │   aiogram 3.x)   │  │   Telegram or    │
                     │                 │  │   desktop)        │
                     └────────┬─────────┘  └────────┬─────────┘
                              │                     │
                              │            API routes│+ server actions
                              │                     ▼
                              │           ┌──────────────────────┐
                              │           │   Next.js 15 App    │
                              │           │   (apps/web)        │
                              │           │                     │
                              │           │  Pages:             │
                              │           │  / → library        │
                              │           │  /quiz/[id]         │
                              │           │  /settings          │
                              │           │  /shared/[token]    │
                              │           │                     │
                              │           │  Services:          │
                              │           │  db.ts (Drizzle)    │
                              │           │  openrouter.ts      │
                              │           │  r2.ts (S3 client)  │
                              │           └──────┬──────────────┘
                              │                  │
                              │        ┌─────────┼──────────┐
                              │        ▼         ▼          ▼
                              │  ┌────────┐┌────────┐┌──────────┐
                              │  │Supabase││OpenRtr ││Cloudflare│
                              │  │(PG SQL)││(AI api)││ R2 (S3) │
                              │  └────────┘└────────┘└──────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  Same Supabase   │
                     │  Database        │
                     │  (reads/writes   │
                     │   notifications) │
                     └──────────────────┘
```

## Directory Structure

### Monorepo Root

```
quiz_app/
├── apps/
│   ├── web/              # Next.js 15 application
│   └── bot/              # Python Telegram bot
├── packages/
│   └── shared/           # Shared TypeScript types + DB schema
├── components/
│   └── ui/               # shadcn/ui components
├── docs/                 # Documentation
├── prompts/              # AI prompt templates
├── turborepo.json
├── package.json          # Workspace root
└── tsconfig.json         # Base TS config
```

### Web App (`apps/web`)

```
apps/web/
├── app/
│   ├── layout.tsx           # Root layout (Inter font, globals)
│   ├── page.tsx             # Library page (default after login)
│   ├── quiz/
│   │   └── [id]/
│   │       ├── page.tsx     # Quiz overview
│   │       ├── practice/
│   │       │   └── page.tsx # Practice mode session
│   │       └── exam/
│   │           └── page.tsx # Exam mode session
│   ├── settings/
│   │   └── page.tsx         # User settings
│   └── shared/
│       └── [token]/
│           └── page.tsx     # Shared quiz import
├── components/
│   ├── library/
│   │   ├── folder-tree.tsx
│   │   ├── quiz-item.tsx
│   │   └── upload-button.tsx
│   ├── quiz/
│   │   ├── question-card.tsx
│   │   ├── results-screen.tsx
│   │   └── timer.tsx
│   └── ui/                  # shadcn primitives
├── lib/
│   ├── db.ts               # Drizzle client
│   ├── openrouter.ts       # OpenRouter API wrapper
│   ├── r2.ts               # Cloudflare R2 client
│   ├── auth.ts             # Telegram auth verification
│   └── utils.ts            # cn(), helpers
├── public/
└── i18n/
    ├── en.json
    ├── uz.json
    └── ru.json
```

### Telegram Bot (`apps/bot`)

```
apps/bot/
├── src/
│   ├── main.py             # Entry point, polling loop
│   ├── config.py           # Env variables, settings
│   ├── db.py               # Database connection (asyncpg)
│   ├── handlers/
│   │   ├── start.py        # /start command → welcome + menu button
│   │   └── menu.py         # Callback queries, inline buttons
│   ├── notifications/
│   │   └── sender.py       # Send messages to users
│   └── models.py           # Data models / dataclasses
├── pyproject.toml
└── requirements.txt
```

### Shared Package (`packages/shared`)

```
packages/shared/
├── src/
│   ├── index.ts
│   ├── schema/             # Drizzle schema definitions
│   │   ├── user.ts
│   │   ├── quiz.ts
│   │   ├── question.ts
│   │   ├── folder.ts
│   │   ├── session.ts
│   │   ├── report.ts
│   │   └── share-link.ts
│   └── types/              # Shared TypeScript types
│       ├── quiz.ts
│       └── api.ts
├── package.json
└── tsconfig.json
```

## Data Flows

### Flow 1: PDF Upload → Quiz Ready

```
1. User uploads PDF via library page
2. Next.js API route (POST /api/files/upload)
   → Stores file in Cloudflare R2
   → Returns file ID
3. Next.js API route (POST /api/ai/parse)
   → Reads file from R2
   → Sends to OpenRouter for text extraction + question parsing
   → Validates AI response
   → Creates Quiz + Questions rows in Supabase via Drizzle
   → Deducts AI credits
   → Triggers bot notification via database flag
4. Bot polls database, sees pending notification
   → Sends Telegram message: "Your quiz [title] is ready."
5. User sees quiz in library on next visit
```

### Flow 2: AI Topic → Generated Quiz

```
1. User enters topic in generate modal
2. Next.js API route (POST /api/ai/generate)
   → Checks credit balance
   → Sends topic to OpenRouter
   → AI may respond with clarifying questions
   → User answers, loop repeats if needed
   → AI generates questions
   → Validates response
   → Creates Quiz + Questions in Supabase
   → Deducts credits
3. User sees new quiz in library
```

### Flow 3: Practice Mode Session

```
1. User opens quiz → clicks Practice Mode
2. Page loads quiz questions from Supabase
3. Client renders one question at a time
4. On answer: POST /api/sessions/:id/answer
   → Stores QuestionResponse (selected_index, is_correct)
   → Returns correct answer + explanation
5. Client shows feedback (green/red)
6. On Next: loads next question
7. On completion: POST /api/sessions/:id/complete
   → Calculates score
   → Returns results
8. Results screen rendered client-side
```

### Flow 4: Exam Mode Session

```
1. User configures duration, clicks Exam Mode
2. Client starts countdown timer (client-side sync)
3. Questions loaded upfront (all at once)
4. User navigates freely, answers, skips
5. Timer expires OR user submits
   → POST /api/sessions/:id/complete
   → Returns score + skipped list
6. Results screen shows review with skipped section
```

## Component Architecture

### Page → Component Tree

```
Library page
├── FolderTree (sidebar)
│   ├── FolderNode (recursive, expandable)
│   └── QuizItem (leaf, clickable)
├── SearchBar
├── SortDropdown
├── UploadButton → FileUpload modal
└── GenerateButton → GenerateQuiz modal

Quiz Overview page
├── QuizMeta (title, count, source, date)
├── RandomizeToggle
├── PracticeModeButton
├── ExamModeButton + DurationSelector
├── ShareButton
├── DeleteButton
└── QuestionPreviewList

Practice page
├── ProgressBar (X of Y)
├── QuestionCard
│   ├── QuestionText
│   ├── OptionsList (A/B/C/D buttons)
│   ├── FeedbackBanner (green/red)
│   └── SkipButton
├── NextButton
├── ReportButton
└── QuitButton

Exam page
├── Timer (countdown)
├── QuestionNavigator (prev/next + grid)
├── QuestionCard (same as practice, no feedback)
│   ├── SkipButton
│   └── SubmitButton

Results page
├── ScoreSummary (X/Y, percentage, time)
├── QuestionReviewList
│   └── QuestionReviewItem (expandable)
│       ├── Your answer
│       └── Correct answer
├── SkippedSection (exam mode only)
├── RetryIncorrectButton (practice only)
├── RestartButton
└── BackToLibraryButton

Settings page
├── DisplayNameField
├── ThemeToggle (light/dark)
├── LanguageSelector (en/uz/ru)
├── CreditsDisplay (balance + refresh date)
└── DeleteAccountButton
```

## API Architecture

All API routes live under `apps/web/app/api/`:

```
app/api/
├── auth/
│   └── telegram/route.ts    # POST → verify Telegram data, issue JWT
├── ai/
│   ├── parse/route.ts       # POST → parse PDF
│   ├── generate/route.ts    # POST → generate from topic
│   └── credits/route.ts     # GET → balance + refresh date
├── quizzes/
│   ├── [id]/
│   │   ├── route.ts         # GET → quiz with questions
│   │   ├── sessions/
│   │   │   └── route.ts     # POST → start session
│   │   ├── share/
│   │   │   └── route.ts     # POST → create share link
│   │   └── restart/
│   │       └── route.ts     # POST → reset session
│   └── route.ts             # PATCH, DELETE
├── sessions/
│   └── [id]/
│       ├── route.ts         # GET → session results
│       ├── answer/route.ts  # POST → submit answer
│       ├── skip/route.ts    # POST → skip question
│       └── complete/route.ts# POST → end session
├── folders/
│   └── route.ts             # GET, POST, PATCH, DELETE
├── files/
│   └── upload/route.ts      # POST → upload to R2
├── shared/
│   └── [token]/
│       ├── route.ts         # GET → shared quiz info
│       └── import/route.ts  # POST → import copy
├── questions/
│   └── [id]/
│       └── report/route.ts  # POST → report question
├── reports/
│   └── route.ts             # GET → owner's reports
└── settings/
    └── route.ts             # GET, PATCH → user settings
```

## Bot Architecture

### Polling Loop

```
aiogram 3.x Dispatcher
│
├── Router: commands
│   ├── /start → welcome + set menu button
│   └── /help → usage instructions
│
├── Router: callbacks
│   └── main menu navigation
│
└── Background task
    └── Polls database every 60 seconds
        └── If pending notification for user → send via bot
```

### Notification Flow

```
1. Web app creates notification in DB (user_id, message, type)
2. Bot background task: SELECT * FROM notifications WHERE sent = false
3. Bot sends message via bot.send_message(chat_id, text)
4. Bot marks notification as sent (sent = true, sent_at = now())
```

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│                  VPS / PaaS                  │
│                                              │
│  ┌───────────────────┐  ┌─────────────────┐ │
│  │  Next.js App      │  │  Telegram Bot   │ │
│  │  (Node.js 20)     │  │  (Python 3.12)  │ │
│  │  Port 3000        │  │  Long-running   │ │
│  │                   │  │  process        │ │
│  └─────────┬─────────┘  └────────┬────────┘ │
│            │                      │          │
└────────────┼──────────────────────┼──────────┘
             │                      │
             ▼                      ▼
     ┌──────────────┐      ┌──────────────┐
     │   Supabase   │      │  Cloudflare  │
     │  (external)  │      │  R2 (ext.)   │
     └──────────────┘      └──────────────┘
```

The web app and bot run on the same or separate hosts. They share the database but have no direct communication — the bot reads notifications that the web app writes.

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Next.js API routes instead of separate backend | Single deploy, shared types, no CORS between frontend and backend |
| Bot polls DB for notifications | No need for a message queue in MVP — simple and reliable |
| Client-side quiz state | Questions can be loaded upfront for exam mode; practice mode is sequential API calls |
| JWT auth tied to Telegram ID | No email/password to manage; Telegram Web App API provides user data |
| Drizzle over raw SQL | Type-safe, migration files, works with Supabase PostgreSQL |
