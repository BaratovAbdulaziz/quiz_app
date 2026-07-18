# Admin Panel

## Access

From the library screen, type `/pathfinder` in the search bar. A password prompt appears (3 attempts). Enter the `ADMIN_PASSWORD` set in your environment variables.

## Features

### Configuration (Export / Import)
- **Export Config** — copies all env vars to clipboard as JSON (one click)
- **Import Config** — paste JSON from another deployment (e.g. local → Railway) to write all env vars at once
- No per-field inputs — configuration is done entirely through environment variables

### Telegram Bot
- View bot status (Running / Stopped / Checking...)
- Start and Stop the bot

### Users
- Dropdown lists all non-test users with `displayName`, `@telegramUsername`, and `tokens` balance
- Select a user to see their current token count
- Add credits to any selected user
- Test users (`is_test_user = 1`) are excluded from the list
- Refresh button re-fetches the user list

### Test API
- Input a topic and click Test to call the AI generation endpoint
- Displays result: number of questions generated, clarification needed, or error message
- Useful for quickly validating that the AI pipeline is working end-to-end

### Danger Zone
- "Kill Site" button: runs `pm2 kill` and `rm -rf` on the project directory
- Irreversible — use only in emergencies

## Schema

All users have an `is_test_user` integer column (default 0). Set to `1` to exclude a user from the admin panel:

```sql
UPDATE users SET is_test_user = 1 WHERE telegram_username = 'my_test_bot';
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/users` | List non-test users with tokens |
| POST | `/api/admin/users` | Add credits to a user (`{ password, userId, credits }`) |
| GET | `/api/admin/bot` | Check bot status |
| POST | `/api/admin/bot` | Start/stop bot (`{ action: "start"|"stop" }`) |
| GET | `/api/admin/config` | Read `.env` values (keys masked) |
| POST | `/api/admin/config` | Write `.env` values |
| GET | `/api/admin/config?export=true` | Export all env vars as JSON |
| GET | `/api/admin/kill` | Check if site is killed |
| POST | `/api/admin/kill` | Kill site |
