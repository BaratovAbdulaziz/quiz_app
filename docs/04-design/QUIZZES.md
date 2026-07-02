# Quizzes

## Quiz Data Model

A quiz consists of:

- **Title**
- **Description** (optional)
- **Source** — uploaded PDF, AI generated, or manually created (future)
- **Questions** — ordered list of question objects

A question object contains:

- **Question text**
- **Options** — list of option strings
- **Correct answer index** — index of the correct option
- **Explanation** (optional)

## Modes

### Practice Mode (Learning Mode)

- Questions are presented one at a time.
- After selecting an answer, immediate feedback is shown: red X for incorrect, green tick for correct, with the correct answer displayed.
- User clicks "Next" to proceed.
- A "Skip" button is available to skip a question without answering.
- A "Retry Incorrect" option is available at the end — retries only the questions answered incorrectly.
- "Restart" is always available to begin the quiz again from scratch.
- At the end, a results screen shows score, percentage, and a review of all questions.
- Users cannot go back to previous questions.
- Practice sessions can be resumed if the user leaves mid-session.

### Exam Mode (Test Simulation)

- A timer counts down (configurable duration, default based on question count).
- Questions are presented with navigation (prev/next or grid).
- No feedback during the exam.
- A "Skip" button is available.
- User submits manually or time expires.
- Results screen shows score, time taken, and a review.
- Skipped questions are listed separately at the end so the user can see what they left unanswered.
- "Restart" is always available.

## Scoring

- Each correct answer = 1 point.
- Incorrect and unanswered (including skipped) = 0 points.
- Percentage = (correct / total) * 100.
- Exam mode records time taken.

## Randomize Quiz

- A "Randomize Quiz" toggle is available in the quiz overview screen.
- When enabled, question order and answer option order are shuffled for each session.
- The correct answer index is adjusted accordingly.

## Quiz Sharing

- A share link is generated and sent to a recipient.
- The recipient opens the link and imports a copy of the quiz into their own library.
- The imported copy is independent — changes to the original do not affect the copy.
- The owner can revoke the link at any time (prevents new imports).

## Reporting

- Users can report questions from practice or review screens.
- Reports include: reason (incorrect answer, formatting, typo, other) and optional comment.
- Reports are sent to the quiz owner for review.

## Future Quiz Features

- Spaced repetition review scheduling (V1.1)
- Bookmarking individual questions (V1.1)
- Adaptive difficulty (V2)
- AI explanations for each answer (V2)

See `FUTURE.md` for details.
