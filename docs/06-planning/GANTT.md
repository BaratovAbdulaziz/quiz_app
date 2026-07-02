# Gantt Plan — MVP

## Timeline

12 weeks total. Each week is 5 working days. Tasks within a phase can run in parallel unless marked as dependent.

```
Week      1  2  3  4  5  6  7  8  9  10 11 12
          │  │  │  │  │  │  │  │  │  │  │  │
P0  Setup ██ ██
P1  Auth     ██ █
P2  Library     ██ █
P3  AI              ██ ██
P4  Quiz Engine           ██ ██
P5  Share + Report              ██ █
P6  Settings                         █
P7  Bot Notif                           █
P8  Test + Polish                          ██ ██
          │  │  │  │  │  │  │  │  │  │  │  │
```

---

## Phase 0 — Project Setup (Week 1–2)

| ID | Task | Depends On | Duration |
|---|---|---|---|
| 0.1 | Initialize Turborepo monorepo | — | 1 day |
| 0.2 | Scaffold Next.js 15 app with TypeScript | 0.1 | 1 day |
| 0.3 | Install Tailwind CSS + shadcn/ui + configure | 0.2 | 1 day |
| 0.4 | Set up Supabase project + configure Drizzle | 0.1 | 1 day |
| 0.5 | Write Drizzle schema (all entities) | 0.4 | 2 days |
| 0.6 | Create Cloudflare R2 bucket + configure SDK | 0.1 | 1 day |
| 0.7 | Scaffold Python bot with aiogram 3.x | 0.1 | 1 day |
| 0.8 | Set up shared package (types + schema) | 0.5 | 1 day |
| 0.9 | Configure CI pipeline (GitHub Actions) | 0.1 | 1 day |
| 0.10 | Set up environment variable management | 0.1 | 1 day |
| 0.11 | Create base layout, globals.css, fonts | 0.2 | 1 day |

**Milestone: Project skeleton complete — apps run locally, DB connected, CI green.**

---

## Phase 1 — Authentication (Week 2–3)

| ID | Task | Depends On | Duration |
|---|---|---|---|
| 1.1 | Implement Telegram login widget in web app | 0.2 | 2 days |
| 1.2 | Verify Telegram auth payload server-side | 1.1 | 1 day |
| 1.3 | Implement JWT creation + refresh token rotation | 1.2 | 2 days |
| 1.4 | Create auth middleware for protected routes | 1.3 | 1 day |
| 1.5 | Implement auto-account creation on first login | 1.2 | 1 day |
| 1.6 | Build bot /start command handler | 0.7 | 1 day |
| 1.7 | Set bot menu button linking to web app | 1.6 | 1 day |
| 1.8 | Auth integration tests | 1.4 | 1 day |

**Milestone: User can open bot → click menu → see web app → account created.**

---

## Phase 2 — Core Library (Week 3–4)

| ID | Task | Depends On | Duration |
|---|---|---|---|
| 2.1 | Build FolderTree component (recursive, expandable) | 0.3 | 2 days |
| 2.2 | Build QuizItem component (leaf node) | 0.3 | 1 day |
| 2.3 | Implement folder CRUD API routes | 0.5 | 2 days |
| 2.4 | Implement quiz CRUD API routes | 0.5 | 2 days |
| 2.5 | Build SearchBar + sort controls | 2.1 | 1 day |
| 2.6 | Build UploadButton → FileUpload modal | 2.4 | 2 days |
| 2.7 | Implement file upload to Cloudflare R2 | 0.6, 2.6 | 2 days |
| 2.8 | Build GenerateQuiz modal (topic input + settings) | 2.4 | 2 days |
| 2.9 | Library page: wire everything together | 2.1, 2.5, 2.6 | 2 days |
| 2.10 | Empty state for first-time users | 2.9 | 1 day |
| 2.11 | Library integration tests | 2.9 | 1 day |

**Milestone: User can upload files, create folders, see quizzes in tree.**

---

## Phase 3 — AI Integration (Week 4–6)

| ID | Task | Depends On | Duration |
|---|---|---|---|
| 3.1 | Build OpenRouter API client | 0.8 | 2 days |
| 3.2 | Implement PDF parsing pipeline (chunk → extract → validate → assemble) | 3.1 | 3 days |
| 3.3 | Implement quiz generation pipeline (topic → clarify → generate → validate) | 3.1 | 3 days |
| 3.4 | Store AI prompts in `prompts/` and version them | 3.2 | 1 day |
| 3.5 | Build AI credits system (balance, deduct, refresh) | 0.5 | 2 days |
| 3.6 | Build `/ai/parse` API route | 3.2, 3.5 | 2 days |
| 3.7 | Build `/ai/generate` API route | 3.3, 3.5 | 2 days |
| 3.8 | Wire upload flow: upload → parse → create quiz | 3.6, 2.7 | 2 days |
| 3.9 | Wire generate flow: topic → clarify → generate → create quiz | 3.7, 2.8 | 2 days |
| 3.10 | Build AI clarification modal (Q&A loop in UI) | 3.9 | 2 days |
| 3.11 | Handle error scenarios (no text, no questions, credits low) | 3.8, 3.9 | 1 day |
| 3.12 | AI integration tests with sample PDFs | 3.8 | 2 days |

**Milestone: User uploads PDF → quiz appears in library. User types topic → quiz appears.**

---

## Phase 4 — Quiz Engine (Week 6–8)

| ID | Task | Depends On | Duration |
|---|---|---|---|
| 4.1 | Build QuestionCard component (text + options A/B/C/D) | 0.3 | 2 days |
| 4.2 | Build QuizOverview page (meta, randomize toggle, mode buttons) | 2.4 | 2 days |
| 4.3 | Implement Practice Mode page (one at a time, feedback, next, skip) | 4.1, 4.2 | 3 days |
| 4.4 | Implement answer submission API route | 0.5 | 1 day |
| 4.5 | Implement session start/complete API routes | 0.5 | 2 days |
| 4.6 | Build Exam Mode page (timer, navigation, submit) | 4.1, 4.2, 4.5 | 3 days |
| 4.7 | Build ResultsScreen component (score, review, skipped list) | 4.5 | 2 days |
| 4.8 | Implement Retry Incorrect (filter wrong answers → new session) | 4.3, 4.7 | 1 day |
| 4.9 | Implement Restart (reset session) | 4.3 | 1 day |
| 4.10 | Implement Resume Practice (save + load session state) | 4.3 | 2 days |
| 4.11 | Implement Randomize Quiz (shuffle questions + options) | 4.3 | 1 day |
| 4.12 | Build Timer component with sync | 4.6 | 1 day |
| 4.13 | Quiz engine integration tests | 4.3, 4.6 | 2 days |

**Milestone: User can practice with feedback and take timed exams. Retry, restart, resume work.**

---

## Phase 5 — Sharing & Reporting (Week 8–9)

| ID | Task | Depends On | Duration |
|---|---|---|---|
| 5.1 | Build share link API (create, revoke) | 0.5 | 1 day |
| 5.2 | Build shared quiz page (token → quiz info → import button) | 5.1 | 2 days |
| 5.3 | Implement import copy (duplicate quiz for recipient) | 5.2 | 2 days |
| 5.4 | Build ShareButton in quiz overview | 5.1 | 1 day |
| 5.5 | Build ReportButton + report modal in practice/review | 4.1 | 2 days |
| 5.6 | Implement report submission API + owner notification | 5.5 | 1 day |
| 5.7 | Build report management page for quiz owners | 5.6 | 2 days |
| 5.8 | Sharing + reporting integration tests | 5.4, 5.7 | 1 day |

**Milestone: Quizzes shareable via link. Questions reportable to owner.**

---

## Phase 6 — Settings & Localisation (Week 9–10)

| ID | Task | Depends On | Duration |
|---|---|---|---|
| 6.1 | Build Settings page UI (name, theme, language, credits, delete) | 0.3 | 2 days |
| 6.2 | Implement settings API (GET, PATCH) | 0.5 | 1 day |
| 6.3 | Implement theme toggle (light/dark + persist) | 6.1 | 1 day |
| 6.4 | Set up i18n with JSON files (en, uz, ru) | 0.3 | 2 days |
| 6.5 | Translate all UI strings to Uzbek and Russian | 6.4 | 3 days |
| 6.6 | Implement language switcher + persist | 6.5 | 1 day |
| 6.7 | Build credits display component | 6.1 | 1 day |
| 6.8 | Implement account deletion flow | 6.2 | 1 day |
| 6.9 | Settings integration tests | 6.2 | 1 day |

**Milestone: User can change language, theme, view credits, delete account.**

---

## Phase 7 — Bot Notifications (Week 10)

| ID | Task | Depends On | Duration |
|---|---|---|---|
| 7.1 | Create notifications table in DB | 0.5 | 1 day |
| 7.2 | Insert notification when PDF parsing completes | 3.8 | 1 day |
| 7.3 | Build bot background polling task (check DB every 60s) | 0.7 | 2 days |
| 7.4 | Send Telegram message for pending notifications | 7.3 | 1 day |
| 7.5 | Mark notifications as sent after delivery | 7.4 | 1 day |
| 7.6 | Build admin broadcast command | 0.7 | 1 day |
| 7.7 | Bot notification integration tests | 7.5 | 1 day |

**Milestone: User gets Telegram notification when quiz is ready.**

---

## Phase 8 — Testing & Polish (Week 10–12)

| ID | Task | Depends On | Duration |
|---|---|---|---|
| 8.1 | Fill remaining unit test gaps | All | 3 days |
| 8.2 | Fill remaining integration test gaps | All | 3 days |
| 8.3 | Component tests for all UI components | All | 3 days |
| 8.4 | Cross-browser testing (Chrome, Firefox, Safari) | All | 2 days |
| 8.5 | Mobile testing in Telegram in-app browser | All | 2 days |
| 8.6 | Performance testing (AI response times, API latency) | All | 1 day |
| 8.7 | Error state audit (every screen: loading, empty, error) | All | 1 day |
| 8.8 | i18n audit (all strings translated, no broken layouts) | 6.5 | 1 day |
| 8.9 | Bug fixes from testing | 8.1–8.8 | 3 days |
| 8.10 | Security review (auth, input validation, rate limits) | All | 1 day |
| 8.11 | Final pre-launch checklist sign-off | 8.9, 8.10 | 1 day |

**Milestone: MVP ready for launch.**

---

## Dependency Graph (Simplified)

```
0.1 Monorepo
  ├── 0.2 Next.js app ── 0.3 Tailwind/shadcn
  │                       ├── 2.1 FolderTree
  │                       ├── 2.2 QuizItem
  │                       ├── 2.6 UploadButton ── 2.7 R2 upload
  │                       ├── 2.8 GenerateModal
  │                       ├── 4.1 QuestionCard
  │                       ├── 4.2 QuizOverview
  │                       ├── 4.3 Practice Mode
  │                       ├── 4.6 Exam Mode
  │                       ├── 5.4 ShareButton
  │                       ├── 5.5 ReportButton
  │                       ├── 6.1 Settings page
  │                       └── 6.4 i18n setup
  │
  ├── 0.4 Supabase ── 0.5 Drizzle schema
  │                    ├── 2.3 Folder CRUD
  │                    ├── 2.4 Quiz CRUD
  │                    ├── 3.5 Credits system
  │                    ├── 4.4 Answer API
  │                    ├── 4.5 Session API
  │                    ├── 5.1 Share link API
  │                    ├── 5.6 Report API
  │                    ├── 6.2 Settings API
  │                    └── 7.1 Notifications table
  │
  ├── 0.6 R2 ── 2.7 Upload
  │
  ├── 0.7 Python bot
  │    ├── 1.6 /start handler ── 1.7 Menu button
  │    └── 7.3 Polling task ── 7.4 Send notification
  │
  └── 0.8 Shared package
       └── 3.1 OpenRouter client
            ├── 3.2 PDF parsing
            └── 3.3 Quiz generation
```

## Resource Allocation

| Role | Phases |
|---|---|
| Full-stack developer (web) | P0, P1, P2, P3, P4, P5, P6, P8 |
| Python developer (bot) | P0, P1 (bot part), P7, P8 |
| AI/prompt engineer | P3 (prompts + validation) |
| Designer (UI review) | P2, P4, P6, P8 |
| Translator (uz/ru) | P6 |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OpenRouter model availability changes | Medium | High | Have fallback models configured |
| PDF parsing accuracy below 90% | Medium | High | Validate with sample PDFs early; iterate prompts |
| Telegram Web App API limitations | Low | Medium | Prototype auth flow first |
| i18n adds significant UI complexity | Medium | Low | Keep translation files flat; test early |
| Bot polling delays notification | Low | Low | Poll interval is acceptable for MVP |
