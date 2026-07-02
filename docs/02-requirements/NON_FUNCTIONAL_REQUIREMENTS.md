# Non-Functional Requirements

## NFR1 — Performance

| ID | Requirement | Target |
|---|---|---|
| NFR1.1 | Page load time (initial) | Under 2 seconds on a standard connection |
| NFR1.2 | Page load time (subsequent) | Under 0.5 seconds (cached) |
| NFR1.3 | AI quiz generation response time | Under 10 seconds for 10 questions |
| NFR1.4 | PDF parsing response time | Under 30 seconds for a 20-page PDF |
| NFR1.5 | API response time (non-AI) | Under 200 ms (p95) |
| NFR1.6 | Quiz session answer submission | Under 500 ms |
| NFR1.7 | File upload time | Progress indicator required for files over 1 MB |
| NFR1.8 | Concurrent users | Support 100 simultaneous active users in MVP |

## NFR2 — Availability & Reliability

| ID | Requirement | Target |
|---|---|---|
| NFR2.1 | System uptime (web app) | 99.5% (excluding planned maintenance) |
| NFR2.2 | System uptime (Telegram bot) | 99% (bot can be offline without affecting web app) |
| NFR2.3 | AI service degradation | Graceful error if OpenRouter is down — queue and retry |
| NFR2.4 | Database failover | Supabase handles this automatically |
| NFR2.5 | Scheduled maintenance window | Weekly, max 1 hour, communicated via bot |

## NFR3 — Scalability

| ID | Requirement | Notes |
|---|---|---|
| NFR3.1 | Horizontal scaling | Next.js can scale via multiple instances; Supabase handles connection pooling |
| NFR3.2 | Database connections | Use connection pooling (Supabase pooler or PgBouncer) |
| NFR3.3 | File storage scaling | Cloudflare R2 is effectively unlimited |
| NFR3.4 | Bot scaling | Single process with polling is sufficient for MVP; can add worker processes later |
| NFR3.5 | AI rate limiting | OpenRouter handles rate limits; queue requests if needed |

## NFR4 — Security

| ID | Requirement | Notes |
|---|---|---|
| NFR4.1 | All traffic over HTTPS | Enforced at the hosting/CDN level |
| NFR4.2 | JWT access tokens | 15-minute expiry |
| NFR4.3 | Refresh token rotation | Old refresh token invalidated on each refresh |
| NFR4.4 | Telegram auth verification | Verify login payload using Telegram's public key |
| NFR4.5 | Input validation | All API inputs validated server-side |
| NFR4.6 | File upload validation | MIME type + magic byte check; max 50 MB |
| NFR4.7 | Sanitise user text | Escape all user-generated text before rendering |
| NFR4.8 | Secrets management | All secrets in environment variables, never in code |
| NFR4.9 | Rate limiting | Login: 5/min per IP. API: 100/min per user. AI: 10/min per user |
| NFR4.10 | Dependency scanning | Run `npm audit` and pip audit in CI |

## NFR5 — Data

| ID | Requirement | Notes |
|---|---|---|
| NFR5.1 | Database backups | Supabase automated daily backups with 7-day retention |
| NFR5.2 | File backups | R2 replication across regions |
| NFR5.3 | User data deletion | Account deletion removes all user data within 30 days |
| NFR5.4 | Data portability | Export all user data as JSON on request (future) |

## NFR6 — Deployment & CI/CD

| ID | Requirement | Notes |
|---|---|---|
| NFR6.1 | Version control | Git on GitHub, trunk-based development with feature branches |
| NFR6.2 | CI pipeline | Run on every push to any branch |
| NFR6.3 | CI checks | TypeScript type check + lint + build + unit tests |
| NFR6.4 | CD pipeline | Automatic deploy to staging on merge to `main` |
| NFR6.5 | Production deploy | Manual trigger from CI after staging verification |
| NFR6.6 | Bot deploy | Separate from web app; can be deployed independently |
| NFR6.7 | Rollback | Support rollback to previous deployment within 5 minutes |
| NFR6.8 | Hosting | TBD (VPS / Railway / Fly.io) |

## NFR7 — Testing

| ID | Requirement | Notes |
|---|---|---|
| NFR7.1 | Unit tests | Cover all API routes, utility functions, and Drizzle queries |
| NFR7.2 | Component tests | Cover all UI components with key states (loading, empty, error) |
| NFR7.3 | Integration tests | Cover critical user flows (login, upload, practice, exam) |
| NFR7.4 | AI output validation tests | Test parsing pipeline with sample PDFs |
| NFR7.5 | Bot tests | Test command handlers and notification sending |
| NFR7.6 | Test coverage target | Minimum 70% for MVP |
| NFR7.7 | Test framework (web) | Vitest + React Testing Library |
| NFR7.8 | Test framework (bot) | pytest + pytest-asyncio |
| NFR7.9 | E2E tests | Playwright for critical flows (future) |

## NFR8 — Monitoring & Observability

| ID | Requirement | Notes |
|---|---|---|
| NFR8.1 | Error logging | Capture and log all API errors with stack traces |
| NFR8.2 | AI request logging | Log prompt, model, response time, token count per request |
| NFR8.3 | Performance monitoring | Track API response times (p50, p95, p99) |
| NFR8.4 | Uptime monitoring | External health check every 5 minutes |
| NFR8.5 | Bot health monitoring | Bot reports its status; restart if unresponsive |
| NFR8.6 | Alerting | Notify the team on repeated errors or downtime |
| NFR8.7 | Logging service | TBD (e.g. Sentry for errors, Grafana for metrics) |

## NFR9 — Development & Tooling

| ID | Requirement | Notes |
|---|---|---|
| NFR9.1 | Language | TypeScript for web app, Python for bot |
| NFR9.2 | Package manager (web) | npm |
| NFR9.3 | Package manager (bot) | pip (with virtual environments) |
| NFR9.4 | Monorepo | Turborepo with `apps/web` and `apps/bot` |
| NFR9.5 | Code formatting | Prettier (web), Ruff (bot) |
| NFR9.6 | Linting | ESLint (web), Ruff (bot) |
| NFR9.7 | Pre-commit hooks | Format + lint on commit |
| NFR9.8 | Environment variables | `.env` files with `.env.example` committed |
| NFR9.9 | Node.js version | 20 LTS or newer |
| NFR9.10 | Python version | 3.12 or newer |

## NFR10 — AI-Specific

| ID | Requirement | Notes |
|---|---|---|
| NFR10.1 | AI provider | OpenRouter (routes to free/open models) |
| NFR10.2 | Model selection | Configurable per operation; fallback if primary model is down |
| NFR10.3 | Prompt versioning | Prompts are stored in `prompts/` and version-controlled |
| NFR10.4 | AI output validation | Every AI response validated before saving (schema, completeness) |
| NFR10.5 | Language preservation | AI must not translate quiz content unless explicitly requested |
| NFR10.6 | Token usage tracking | Track tokens spent per user for cost analysis |
| NFR10.7 | PDF parsing library | TBD (experiment with pdf.js, PyMuPDF, or OpenRouter Vision) |

## NFR11 — Localisation

| ID | Requirement | Notes |
|---|---|---|
| NFR11.1 | UI languages | English (en), Uzbek (uz), Russian (ru) |
| NFR11.2 | i18n framework | TBD (next-intl, react-i18next, or similar) |
| NFR11.3 | Translation source | Static JSON files per language |
| NFR11.4 | Content language | Quiz content stays in original language — never translated by AI |

## NFR12 — Browser & Device Support

| ID | Requirement | Notes |
|---|---|---|
| NFR12.1 | Supported browsers | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| NFR12.2 | Mobile support | Responsive design; Telegram's in-app browser is primary target |
| NFR12.3 | Desktop support | Full experience on desktop browsers |
| NFR12.4 | Offline mode | Not supported in MVP |
