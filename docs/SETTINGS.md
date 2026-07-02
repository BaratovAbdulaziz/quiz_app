# Settings

## User Profile

| Setting | Type | Default | Description |
|---|---|---|---|
| Display name | string | Telegram first name | Public-facing name |

## Preferences

| Setting | Type | Default | Description |
|---|---|---|---|
| Theme | enum | system | light, dark, system |
| Language | enum | en | English, Uzbek, Russian |

## AI Credits

| Setting | Type | Description |
|---|---|---|
| Current balance | integer (read-only) | Remaining AI credits |
| Next refresh date | date (read-only) | When credits are refreshed |

Credits are refreshed every 15 days automatically.

## Account Actions

| Action | Description |
|---|---|
| Delete account | Permanently deletes account and all associated data. Requires confirmation. |

## Session Management

- View active sessions.
- Revoke individual sessions.
- Revoke all sessions.

## Data Export (Future)

- Export all quizzes as JSON.
- Export all quizzes as PDF.
- Export session history.
