# Admin Panel

An admin panel is available for managing API keys. It is hidden and requires a secret access method.

## Features

- View all API keys with their provider and status (active/inactive)
- Copy any API key to clipboard
- Test API keys against their provider endpoint to check health (valid, invalid, exhausted, error)
- Provider support: **OpenAI**, **Groq**, **OpenRouter**
- Add new API keys with provider selection (manual entry or auto-generate with provider-specific prefix)
- Toggle key status between active/inactive
- Delete API keys
- Export all keys as JSON with hashed values (SHA-256)

## Providers

| Provider    | Endpoint | Key Prefix |
|-------------|----------|------------|
| OpenAI      | `https://api.openai.com/v1/models` | `sk-` |
| Groq        | `https://api.groq.com/openai/v1/models` | `gsk_` |
| OpenRouter  | `https://openrouter.ai/api/v1/models` | `sk-or-` |

The Test button pings the provider's models endpoint with `Authorization: Bearer <key>`. A `200` response means healthy; `401`/`403` means invalid; `429`/`402` means exhausted/out of credits.

## Access

The admin panel can be accessed from the library screen using a hidden trigger. The trigger is intentionally undocumented to prevent casual access.
