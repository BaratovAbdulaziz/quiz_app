# Authentication

## Supported Method

- Telegram login only.

## How It Works

There is no registration form. The application uses Telegram's login widget. When a user authenticates via Telegram, an account is automatically created if one does not already exist.

## Flow

1. User opens the application.
2. Login screen shows the Telegram login button.
3. User clicks the button and is redirected to Telegram.
4. User authorizes the application in Telegram.
5. Telegram returns user data (ID, username, first name, last name, photo).
6. System looks up the user by Telegram ID.
7. If the user exists, a session is created.
8. If the user does not exist, an account is created automatically with the Telegram data.
9. User is redirected to the library.

There is no email, no password, no verification step, and no "forgot password" flow.

## Session Management

- Access tokens expire after 15 minutes.
- Refresh tokens expire after 30 days.
- Refresh tokens are rotated on use.
- Sessions can be revoked from settings.

## Security

- Telegram login widget uses a secure redirect flow.
- The system verifies the Telegram authentication payload using Telegram's public key.
- HTTPS only for all requests.
- Rate limiting: 5 login attempts per minute per IP.
