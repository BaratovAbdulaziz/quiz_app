# Documentation

This folder is the single source of truth for the quiz study platform.

## Purpose

Provide a complete, maintainable, and navigable knowledge base for both humans and AI assistants working on this project.

## Folder Organization

Each document covers one domain. Documents are modular and reference each other where appropriate.

| Document | Covers |
|---|---|
| `PROJECT_VISION.md` | Problem, users, philosophy, product principles |
| `MVP.md` | Version 1 scope only |
| `ROADMAP.md` | High-level development timeline |
| `FEATURES.md` | Structured feature inventory |
| `USER_FLOWS.md` | Step-by-step user journeys |
| `UI_UX.md` | Screen documentation |
| `AI.md` | AI pipeline, prompt strategy, validation |
| `AUTHENTICATION.md` | Auth flows and providers |
| `LIBRARY.md` | Personal quiz library |
| `QUIZZES.md` | Quiz engine, modes, scoring |
| `CREDITS.md` | Third-party credits |
| `DATABASE.md` | Data model and schema |
| `API.md` | API endpoints |
| `SECURITY.md` | Security considerations |
| `SETTINGS.md` | User settings |
| `PERMISSIONS.md` | Permissions and roles |
| `ARCHITECTURE.md` | High-level system architecture |
| `DECISIONS.md` | Decision log |
| `FUTURE.md` | Post-MVP plans |
| `CHANGELOG.md` | Project changelog |

## Where to Start

If you are new to the project, read in this order:

1. `PROJECT_VISION.md` — understand the why
2. `MVP.md` — understand the scope
3. `ARCHITECTURE.md` — understand the system
4. `FEATURES.md` — understand what exists
5. `USER_FLOWS.md` — understand how it works

From there, dive into any domain document as needed.

## Conventions

- Titles use ATX headings (`#`).
- Every document starts with a title and a purpose section.
- Cross-references use relative links to other `.md` files.
- Terminology is consistent across all documents (see glossary in `PROJECT_VISION.md`).
- Placeholders are avoided unless truly unavoidable.
- Files are flat within `docs/` for simplicity — no subdirectories.
