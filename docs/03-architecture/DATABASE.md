# Database

## Overview

**Supabase** (managed PostgreSQL) is the primary data store. Cloudflare R2 (S3-compatible) is used for PDF files. Queries and migrations are handled via **Drizzle ORM**.

## Core Entities

### User

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| telegram_id | bigint | Unique, from Telegram |
| telegram_username | string | Nullable |
| display_name | string | From Telegram |
| credits | integer | Current AI credit balance |
| credits_refresh_at | timestamp | When credits are next refreshed |
| created_at | timestamp | |
| updated_at | timestamp | |

### Quiz

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to User |
| folder_id | UUID | Nullable, foreign key to Folder |
| title | string | |
| description | text | Nullable |
| source | enum | uploaded_pdf, ai_generated |
| source_file_id | UUID | Nullable, foreign key to File |
| question_count | integer | |
| randomize | boolean | Default true |
| created_at | timestamp | |
| updated_at | timestamp | |

### Folder

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to User |
| parent_id | UUID | Nullable for nested folders |
| name | string | |
| created_at | timestamp | |
| updated_at | timestamp | |

### Question

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| quiz_id | UUID | Foreign key to Quiz |
| text | text | |
| options | jsonb | Array of strings |
| correct_index | integer | Index into options array |
| explanation | text | Nullable |
| order | integer | Position in quiz |
| created_at | timestamp | |

### File

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to User |
| original_name | string | |
| storage_key | string | Key in object storage |
| mime_type | string | |
| size_bytes | integer | |
| created_at | timestamp | |

### QuizSession

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| quiz_id | UUID | Foreign key to Quiz |
| user_id | UUID | Foreign key to User |
| mode | enum | practice, exam |
| status | enum | in_progress, completed |
| score | integer | |
| total | integer | |
| skipped_count | integer | |
| time_seconds | integer | Nullable |
| completed_at | timestamp | Nullable |
| created_at | timestamp | |

### QuestionResponse

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| session_id | UUID | Foreign key to QuizSession |
| question_id | UUID | Foreign key to Question |
| selected_index | integer | Nullable if skipped |
| is_correct | boolean | Nullable if skipped |
| is_skipped | boolean | |
| answered_at | timestamp | |

### QuestionReport

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| reporter_id | UUID | Foreign key to User (reporter) |
| owner_id | UUID | Foreign key to User (quiz owner) |
| question_id | UUID | Foreign key to Question |
| reason | enum | incorrect_answer, formatting, typo, other |
| comment | text | Nullable |
| status | enum | pending, reviewed, resolved |
| created_at | timestamp | |

### ShareLink

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| quiz_id | UUID | Foreign key to Quiz |
| created_by | UUID | Foreign key to User |
| token | string | Unique, used in URL |
| active | boolean | |
| created_at | timestamp | |

## Indexes

- User: telegram_id (unique)
- Quiz: user_id, folder_id, created_at
- Folder: user_id, parent_id
- Question: quiz_id, order
- QuizSession: user_id, quiz_id, created_at
- ShareLink: token (unique)
- QuestionReport: owner_id, status
