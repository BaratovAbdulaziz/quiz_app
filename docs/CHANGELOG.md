# Changelog

## 2026-07-14 — PPTX Presentation Generation v1

- **Added Presentation content type**: New "Presentation" option in the Create dropdown alongside Quiz and Crossword. Users can generate AI-powered presentations on any topic.
- **AI presentation generation**: New `generatePresentation` Convex action that calls OpenRouter to produce structured slide data (title, content bullets, layout types). Generates 3-20 slides with educational content.
- **Convex schema**: New `presentations` and `presentationSlides` tables with full CRUD operations, trash management, and folder support.
- **PPTX export**: Client-side PPTX generation using `pptxgenjs` library. Supports 4 slide layouts: title, titleContent, twoColumn, and blank. Downloads as `.pptx` file with QuizFlow branding.
- **Presentation screen**: New `"presentation"` screen shows slide overview with layout badges and bullet point content. Download PPTX button in header.
- **Library integration**: Presentations appear in the library tree with a blue `Presentation` icon (lucide). Support drag-and-drop, folder organization, batch select/move/delete.
- **Trash support**: Deleted presentations go to trash with restore and permanent delete functionality.
- **i18n**: Added presentation-related translation keys in English, Uzbek, and Russian.
- **Dependencies**: Added `pptxgenjs` ^3.12.0 for PPTX file generation.

## 2026-07-09 — Print Elegance, Actions Dropdown, Clue Polish, From-Text Format Example

- **Format example in paste modal**: Added a visible sample box below the textarea in the "From text" crossword dialog showing the `clue: ANSWER` format with a "Copy sample" button, making it easy for users and AI to copy the expected format.

- **Teachers icon**: Replaced emoji "📊" with lucide `BarChart3` icon in both quiz overview and crossword dropdown for a consistent, modern look.
- **Duplicate logo fix**: `.crossword-print-header` now hidden on screen (`display: none`), only shown in print. Eliminates the duplicate QuizFlow logo visible during crossword solving.
- **Clue polish (screen)**: Added `.clues-section` wrapper and `.clue-number` pill badge (small circle with number) for a more professional, structured look. Letter count shown after each clue. Slightly increased padding (p-2 → p-2.5). Clue items use `flex items-baseline` for better alignment.
- **Print elegance**: Crossword print now centers vertically on page (`justify-content: center` + `min-height: 100vh`). Font upgraded to Palatino/Book Antiqua serif stack for a more elegant bookish look. QuizFlow logo (green SVG) shown in print header alongside centered title (18pt). Print header uses column layout (logo above title, then small "QuizFlow" subtitle). Grid centered with `transform-origin: center center`. Clue text refined to 8.5pt with 7.5pt micro-uppercase headings. `@page { margin: 0 }` suppresses browser print header/footer. `.crossword-page` adds `border: none` and 30pt padding. Grid numbers use Helvetica/Arial. Clue number badge styled for print.
- **Actions dropdown**: Right-side `MoreVertical` button collapses Answer Key (toggle), Teachers (analytics), Download PDF, Print, and Print Key into a clean popover menu. Primary Check Answers and Clear All remain as visible buttons. Click-away closes the menu.

## 2026-07-09 — Teachers Mode (Analytics), Answer Key, Crossword Sharing, Shared Page, Print Polish

- **Teachers Mode (analytics dashboard)**: New `sharedAttempts` Convex table tracks participant attempts on shared quizzes/crosswords. New `TeachersModeModal` component shows content creators a dashboard with attempt count, completed count, average percentage, and per-attempt breakdown (score/percentage per participant). Accessible from the "📊 Teachers" button on quiz overview and crossword screens.
- **Answer Key (renamed from "Teachers Key")**: What was previously called "Teachers Key" is now "Answer Key" — a toggle on quiz overview (expands questions with correct answers ✓) and crossword screen (fills grid with answers). This is separate from the analytics-focused Teachers Mode.
- **Shared content page**: New `/shared/[token]` page (`apps/web/app/shared/[token]/page.tsx`) where recipients can take a shared quiz directly. Records attempts to `sharedAttempts` for the creator to review. Crossword shared pages show clues with letter counts.
- **Crossword sharing**: Added `crosswordId` field to `shareLinks` Convex table alongside `itemType` discriminator. New `generateCrosswordLink` mutation and extended `getByToken`/`importQuiz` to handle both quiz and crossword imports. Share button (Share2 icon) added to crossword header.
- **Print makeover**: `@page` margin set to `0.5in`. Print font changed to Georgia/Times New Roman serif. Clue grid uses `grid-template-columns: 1fr 1fr` with 24px gap. Clue items use dotted bottom borders instead of full borders. Crossword title displayed via `.crossword-print-title` element (hidden on screen, shown in print). Grid scale reduced from 1.6 to 1.4 for cleaner fit. Overall alignment changed from `justify-content: center` to `flex-start` to avoid squashing.

## 2026-07-09 — Crossword Print, Syntax Mode, Crossword File Management

- **Crossword print improvements**: White background forced on all elements in `@media print` with `print-color-adjust: exact`. Aggressive selectors (`html, body, #root, main`, etc.) kill dark backgrounds. CSS class names (`crossword-card`, `crossword-grid`, `crossword-cell`, `crossword-number`, `crossword-letter`, `blocked`, `crossword-page`) added for precise print targeting.
- **Print centering**: `.crossword-page` uses `height: 100vh; display: flex; justify-content: center; align-items: center` to vertically center the grid on the printed page. Grid scaled to 1.6×, clues constrained to 80% width.
- **Numbers in crossword cells**: `onKeyDown` regex changed from `/^[a-zA-Z]$/` to `/^[a-zA-Z0-9]$/` so digits can be typed.
- **Print button**: Added "Print" (blank puzzle) button alongside existing "Print Key". `printBlankPuzzle` calls `window.print()` directly without showing answers.
- **Syntax mode**: Added "Paste Content" option in quiz type modal with `PasteQuizModal` component for pasting JSON quiz content directly.
- **Clue text in print**: Explicit `color: #000000 !important` set on `text-ink`, `text-steel`, `micro-uppercase` classes inside print to fix invisible clue text caused by CSS variable color references.
- **Crossword file management**: Added `update` and `batchMove` Convex mutations. `useCrosswords` hook now exposes `updateCrossword`, `batchDeleteCrosswords`, `batchMoveCrosswords`, `restoreCrosswords`, `permanentDeleteCrosswords`. Library sidebar now shows rename/delete hover buttons for crosswords, enables drag-and-drop to folders, and crosswords participate in batch select/move/delete operations. Trash page includes a crosswords section with restore/permanent-delete.

## 2026-07-09 — Crossword Generator, Unified Create Menu, UX Polish

- **Added Crossword Generator**: Full crossword system with two creation paths — AI generation (topic/difficulty/language → OpenRouter prompt returns across/down clues) and manual entry (clue/answer/direction rows). New Convex tables: `crosswords` and `crosswordClues` with indexes. New `generateCrossword` action, `crosswords:create` mutation, `crosswords:list`/`get` queries, and trash management mutations.
- **Crossword Library Display**: Crosswords appear alongside quizzes in the library tree, distinguished by an amber `Grid3x3` icon vs the blue `FileText` icon for quizzes. Search filtering and folder grouping include both types.
- **Crossword Solve Screen**: New `"crossword"` screen with Across/Down clue sections, per-clue input fields (uppercase, maxLength constrained by word length), and a Check Answers button that validates against stored words with green/red feedback.
- **Unified "Create" Dropdown**: Replaced separate Upload/Generate buttons with a single "Create" dropdown containing Quiz and Crossword options. Quiz opens a sub-modal with "Generate with AI" and "Upload PDF" cards. Crossword opens a sub-modal with "Generate with AI" and "Clue / Answer / Word" cards.
- **Difficulty & Language in Quiz Generation**: Added Easy/Medium/Hard difficulty and English/Uzbek/Russian language toggles in the AI quiz generation modal. Passed through Convex schema, mutation args, AI action, and `useAi` hook.
- **Credits Sync Fix**: Admin credit adjustment now calls `adjustCreditsByClerkId` Convex mutation to sync Convex with PG, plus immediate local state update for the current user. Modified `syncUser` to accept optional `credits`/`creditsRefreshAt`; `useCurrentUser` hook fetches credits from PG on login.
- **Username persistence**: Added localStorage fallback for username on save and hydration from localStorage on startup.
- **Dropdown animations**: Framer-motion `whileHover`/`whileTap` spring animations on all dropdown items, `AnimatePresence` with enter/exit animations on the create menu.
- **Refined Quiz Type Modal**: Larger cards (p-5, w-12 icons, rounded-2xl) with colored gradient icon backgrounds, framer-motion spring hover effects, close (X) button, and ChevronRight affordance.

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
