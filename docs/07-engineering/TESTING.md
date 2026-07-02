# Testing

## Strategy

Three-tier approach for MVP:

| Tier | Type | Scope | Target Coverage |
|---|---|---|---|
| 1 | Unit + Component | Individual functions, React components | 70% |
| 2 | Integration | API routes, database queries, user flows | Key flows only |
| 3 | E2E | Critical paths in a real browser | Future (V1.1) |

## Web App Testing

### Framework

- **Vitest** — test runner (fast, native TypeScript, compatible with Next.js)
- **React Testing Library** — component tests (behaviour over implementation)
- **MSW** (Mock Service Worker) — mock API responses in tests

### What to Test

#### Unit Tests

| Module | What to Test |
|---|---|
| `lib/utils.ts` | `cn()`, `generateUniqueId()` |
| `lib/openrouter.ts` | Request formatting, response parsing, error handling |
| `lib/r2.ts` | Upload, signed URL generation |
| `lib/auth.ts` | JWT creation/verification, Telegram data verification |
| `lib/db.ts` | Drizzle query helpers |
| Shared types | Validation functions |

#### Component Tests

| Component | States to Cover |
|---|---|
| `QuestionCard` | Default unanswered, answered correct, answered incorrect, skipped |
| `ResultsScreen` | All correct, all wrong, mixed, with skipped questions |
| `FolderTree` | Empty, with folders, selected folder |
| `QuizItem` | Default, selected, long title truncated |
| `Timer` | Running, paused, expired |
| `DropZone` | Empty, dragging file, file selected, error state |
| `FileList` | Empty, with files, uploading, error |
| `ChatGPTInput` | Empty, typing, with mode selected, disabled |
| `Settings` | All fields populated, save success, save error |
| `LoginButton` | Default, loading, error |

#### Integration Tests

| Flow | What to Verify |
|---|---|
| Upload PDF → quiz created | File stored in R2, quiz + questions in DB, credits deducted |
| AI generate → quiz created | Valid response, quiz in library, credits deducted |
| Practice mode flow | Answers recorded, feedback shown, results calculated |
| Exam mode flow | Answers recorded, no feedback during, timer respected |
| Share quiz → import copy | Share link created, recipient gets independent copy |
| Report question | Report stored, visible to owner |
| Auth flow | JWT issued, protected routes reject without token |

### Test File Convention

Tests live next to the file they test:

```
lib/
├── utils.ts
└── utils.test.ts

components/ui/
├── question-card.tsx
└── question-card.test.tsx
```

### Running Tests

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Bot Testing

### Framework

- **pytest** — test runner
- **pytest-asyncio** — async test support
- **pytest-mock** — mocking

### What to Test

| Module | What to Test |
|---|---|
| `handlers/start.py` | Welcome message, menu button set |
| `handlers/menu.py` | Callback handling |
| `notifications/sender.py` | Message formatting, sending logic |
| `db.py` | Query building, connection handling |

### Running Tests

```bash
cd apps/bot
pytest                                # All tests
pytest -x -v                          # Fail fast, verbose
pytest tests/ --cov=src               # With coverage
```

## CI Integration

Tests run on every push:

```yaml
# .github/workflows/ci.yml (planned)
on: [push]

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test -- --coverage

  bot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -r apps/bot/requirements.txt
      - run: pytest apps/bot/ --cov=src
```

## Testing Checklist (Pre-Launch)

- [ ] All API routes return correct status codes for success and error cases
- [ ] AI parsing handles valid PDF, image-only PDF, and malformed PDF
- [ ] AI generation handles valid topic, empty topic, and clarification loop
- [ ] Practice mode: answer → feedback → next → results → retry → restart
- [ ] Exam mode: timer start → answer → skip → submit → results with skipped list
- [ ] Library: create folder, rename, move quiz, delete, search
- [ ] Sharing: generate link, open link, import copy, revoke link
- [ ] Credits: display balance, deduct on AI use, refresh after 15 days
- [ ] Settings: change name, theme, language, delete account
- [ ] Bot: /start, menu button, notification delivery
- [ ] Auth: login, session expiry, refresh token rotation
- [ ] Localisation: UI renders in all three languages without layout breakage
- [ ] Mobile: all screens render correctly in Telegram in-app browser
- [ ] 404 pages for unknown quiz, folder, or share link
