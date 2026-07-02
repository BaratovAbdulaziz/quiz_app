# Documentation

Single source of truth for the quiz study platform.

## Folder Organization

```
docs/
├── 01-vision/            Problem, users, philosophy, MVP scope
├── 02-requirements/      Features, functional/non-functional reqs, personas
├── 03-architecture/      System design, tech stack, DB, API, auth, security
│   └── tech-stack/       Web app + Telegram bot specifics
├── 04-design/            UI/UX, user flows, quiz engine, library
├── 05-ai/                AI pipeline, prompts, validation
├── 06-planning/          Roadmap, Gantt, decisions, future plans
├── 07-engineering/       Testing, settings, credits, changelog
├── CHANGELOG.md          Project change history
└── README.md             This file
```

## Where to Start

1. `01-vision/PROJECT_VISION.md` — understand the why
2. `01-vision/MVP.md` — understand the scope
3. `03-architecture/ARCHITECTURE.md` — understand the system
4. `02-requirements/FEATURES.md` — understand what exists
5. `04-design/USER_FLOWS.md` — understand how it works

## Conventions

- Titles use ATX headings (`#`).
- Every document starts with a title and a purpose section.
- Cross-references use relative paths (e.g. `../03-architecture/DATABASE.md`).
- Terminology is consistent across all documents.
- Placeholders are avoided unless truly unavoidable.
- Folders are numbered for ordering.
