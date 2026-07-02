# Permissions

## MVP

The MVP has a minimal permission model:

- **Owner** — full access to own quizzes and folders (create, read, update, delete).
- **Report recipient** — when a question is reported, the report is sent to the quiz owner.

There are no roles. There are no editors. There are no viewers. Every user is an owner of their own content.

## Ownership Rules

- A user owns all quizzes and folders they create.
- Ownership is not transferable in MVP.
- Deleting a user deletes all owned resources.

## Sharing Model (MVP)

- A share link is generated and sent to a recipient.
- The recipient opens the link and imports a copy of the quiz into their own library.
- The imported copy is independent — changes to the original do not affect the copy and vice versa.
- The owner can revoke the link at any time (prevents new imports).
- There is no view-only access. The recipient gets their own editable copy.

This is intentionally simple: share by link → recipient imports a copy.

## Reporting

- A user can report an incorrect answer.
- The report is sent to the quiz owner, not to an admin.
- The owner can review the report and update the question if needed.

## Future

No role-based permissions or teams are planned. The sharing model may be extended in the future, but complexity is intentionally avoided.
