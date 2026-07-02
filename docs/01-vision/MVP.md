# MVP (Version 1)

## Scope

The MVP delivers the smallest possible product that provides exceptional value.

### MVP Features

- Telegram login with auto-account creation
- PDF upload and AI parsing of multiple-choice questions
- AI quiz generation from a topic prompt (with follow-up clarification)
- AI credits system (refreshed every 15 days)
- Interactive practice mode with immediate feedback (red X / green tick)
- Skip questions
- Retry incorrect answers (practice mode only)
- Restart quiz
- Randomize quiz toggle
- Resume incomplete practice sessions
- Exam mode with timed, non-interactive simulation
- Skipped questions listed separately in exam results
- Personal quiz library organized as a tree-style list with folders
- Quiz sharing via link (recipient imports a copy)
- Report question to owner
- User settings (profile, theme, language, credits)
- UI languages: English, Uzbek, Russian

### Excluded from MVP

Anything not listed above belongs in `FUTURE.md`.

The MVP intentionally omits:
- Public quiz discovery
- Social features
- Advanced analytics
- Team or classroom features
- Offline mode
- Mobile apps (responsive web only)
- Third-party integrations

## Success Criteria

- A student can upload a PDF and start practicing within 30 seconds.
- A student can enter a topic and receive a generated quiz within 10 seconds.
- A student can practice repeatedly with immediate feedback on each answer.
- A student can simulate a timed exam.
- The system reliably parses PDFs with at least 90% structural accuracy for well-formed multiple-choice documents.
