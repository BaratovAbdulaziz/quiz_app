# Security

## Authentication

- JWT access tokens (15-minute expiry) with refresh token rotation.
- Telegram login payload verified using Telegram's public key.
- Rate limiting on login (5 attempts per minute per IP).

## Data Protection

- All API traffic over HTTPS only.
- PDF files stored in S3-compatible object storage with server-side encryption.
- Database connection encrypted (TLS).
- User data can be deleted on account deletion.

## Input Validation

- All API inputs validated server-side.
- File uploads limited to PDF format (MIME type and magic byte validation).
- Maximum file size: 50 MB per upload.
- Sanitize all user-generated text displayed in the UI.

## Session Management

- Refresh tokens stored hashed in the database.
- Sessions can be revoked individually or all at once.

## AI Service

- AI requests include only the content being processed (no metadata or identifiers).
- AI responses are validated before being stored.
- AI service runs in a separate, isolated environment.

## Development Practices

- No secrets or keys in source code (environment variables).
- Dependency scanning in CI/CD pipeline.
- Regular security dependency updates.
- Admin endpoints require elevated authentication.

## Incident Response

- Rate limit abuse: temporary IP ban after threshold.
- Suspected account compromise: invalidate all sessions.
- Data breach notification plan for affected users.
