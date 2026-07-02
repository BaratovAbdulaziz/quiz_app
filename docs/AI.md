# AI

## Responsibilities

The AI service handles three tasks:

1. Parse PDF files to extract multiple-choice questions.
2. Generate quizzes from a user-provided topic.
3. Validate and structure extracted or generated content.

The AI never modifies user content unnecessarily. All content remains in its original language unless the user explicitly requests translation.

---

## PDF Parsing Pipeline

1. **File reception** — PDF is uploaded and stored in object storage.
2. **Text extraction** — PDF text is extracted using OCR or native text extraction.
3. **Chunk processing** — Extracted text is split into logical chunks (by page, section, or delimiter).
4. **Question identification** — Each chunk is analyzed to identify question-answer structures.
5. **Structuring** — Identified questions are formatted into a standard schema (question text, options, correct answer, optional explanation).
6. **Validation** — Each structured question is validated for completeness and correctness.
7. **Assembly** — Validated questions are assembled into a quiz object.

### Chunk Processing

- Documents are split into overlapping chunks to avoid cutting off questions.
- Each chunk is processed independently with context from adjacent chunks.
- Deduplication is applied after all chunks are processed.

### Validation Pipeline

Each extracted question must pass these checks:

- Question text is non-empty.
- At least two answer options exist.
- Exactly one correct answer is identified.
- No duplicate questions within the same quiz.
- Option text is non-empty.

Failed questions are flagged for manual review rather than silently dropped.

---

## AI Credits

- AI operations consume credits.
- Every user receives a free credit refresh every 15 days.
- Credits are deducted for PDF parsing and quiz generation.
- If credits are insufficient, the operation is rejected with a clear message.
- Future: credit top-up options (see `FUTURE.md`).

## Quiz Generation

When a user enters a topic:

1. System checks the user's credit balance.
2. If sufficient credits, system constructs a prompt with the topic.
3. AI may ask follow-up clarification questions if the topic is ambiguous or incomplete.
4. User responds to any AI questions.
5. AI generates questions in the structured schema format.
6. Validation pipeline runs on generated questions.
7. If insufficient valid questions are generated, the system retries with adjusted prompts.
8. Credits are deducted.
9. Assembled quiz is saved to the user's library root folder.

---

## Prompt Strategy

- Prompts are structured with clear role, task, output format, and constraints.
- Few-shot examples are included for complex extraction tasks.
- Temperature is kept low (0.1–0.3) for extraction and slightly higher (0.5–0.7) for generation.
- The system prompt specifies the exact JSON output schema.
- Language preservation is explicitly instructed.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Insufficient credits | Return error: "Insufficient AI credits. Credits will refresh on [date]." |
| PDF has no extractable text | Return error: "No text could be extracted from this PDF." |
| PDF is scanned image-only | Return error: "This PDF appears to be a scanned image. OCR is required." |
| PDF contains no questions | Return error: "No questions could be found in this document." |
| Generated questions fail validation | Retry once with stricter prompt; if still failing, return error. |
| AI service unavailable | Queue job for retry; notify user when complete. |
| Rate limited | Exponential backoff with user-facing progress indicator. |

---

## Future AI Features

- AI-generated answer explanations (V2)
- Adaptive difficulty adjustment (V2)
- AI study guide generation from quiz content (V2)
- AI-suggested quiz improvements (V2)

See `FUTURE.md` for details.
