# Functional Requirements

## FR1 — Authentication

| ID | Requirement | Priority |
|---|---|---|
| FR1.1 | The system shall authenticate users exclusively via Telegram login. | Critical |
| FR1.2 | The system shall create an account automatically on first Telegram login. | Critical |
| FR1.3 | The system shall recognise returning users by their Telegram ID. | Critical |
| FR1.4 | The bot shall provide a menu button that opens the web app. | Critical |
| FR1.5 | The web app shall receive authenticated user data from Telegram's Web App API. | Critical |

## FR2 — PDF Upload & Parsing

| ID | Requirement | Priority |
|---|---|---|
| FR2.1 | The system shall accept PDF file uploads up to 50 MB. | Critical |
| FR2.2 | The system shall validate that uploaded files are valid PDFs (MIME type + magic bytes). | Critical |
| FR2.3 | The system shall send the PDF to AI for text extraction and question parsing. | Critical |
| FR2.4 | The system shall extract multiple-choice questions (question text, options, correct answer) from the PDF. | Critical |
| FR2.5 | The system shall create a new quiz in the library root folder after successful parsing. | Critical |
| FR2.6 | The system shall show a progress indicator during upload and parsing. | Critical |
| FR2.7 | The system shall show a clear error message if parsing fails, with a retry option. | High |
| FR2.8 | The system shall store the original PDF file in Cloudflare R2. | Critical |
| FR2.9 | The system shall notify the user via Telegram bot when parsing is complete. | Medium |

## FR3 — AI Quiz Generation

| ID | Requirement | Priority |
|---|---|---|
| FR3.1 | The system shall accept a topic string from the user. | Critical |
| FR3.2 | The system shall route AI requests through OpenRouter. | Critical |
| FR3.3 | The system shall allow AI to ask follow-up clarification questions if the topic is ambiguous. | Medium |
| FR3.4 | The system shall generate multiple-choice questions in the standard schema format. | Critical |
| FR3.5 | The system shall validate generated questions before saving. | Critical |
| FR3.6 | The system shall save the generated quiz to the library root folder. | Critical |
| FR3.7 | The system shall deduct AI credits upon successful generation. | High |
| FR3.8 | The system shall show a loading state during generation. | High |
| FR3.9 | The system shall show an error if credits are insufficient. | High |

## FR4 — Quiz Library

| ID | Requirement | Priority |
|---|---|---|
| FR4.1 | The system shall display the user's quizzes in a tree-style list with expandable folders. | Critical |
| FR4.2 | The user shall be able to create, rename, and delete folders. | Critical |
| FR4.3 | The user shall be able to rename, move, and delete quizzes. | Critical |
| FR4.4 | The user shall be able to search quizzes by title. | High |
| FR4.5 | The user shall be able to sort quizzes by name, date, and question count. | Medium |
| FR4.6 | New quizzes shall be placed in the root folder by default. | Critical |
| FR4.7 | Empty folders shall be hidden from the tree. | Low |

## FR5 — Practice Mode

| ID | Requirement | Priority |
|---|---|---|
| FR5.1 | The system shall display one question at a time. | Critical |
| FR5.2 | The user shall select an answer from the available options. | Critical |
| FR5.3 | The system shall show immediate feedback: green tick for correct, red X for incorrect with correct answer shown. | Critical |
| FR5.4 | The user shall click "Next" to proceed to the next question. | Critical |
| FR5.5 | The user may skip a question without answering. | Medium |
| FR5.6 | The user cannot return to a previous question. | Critical |
| FR5.7 | The system shall show a results screen after the final question (score, percentage, review). | Critical |
| FR5.8 | The user may retry only the incorrectly answered questions. | Medium |
| FR5.9 | The user may restart the quiz from the beginning at any time. | Medium |
| FR5.10 | Incomplete practice sessions shall be saved and resumable. | Medium |
| FR5.11 | The "Randomize Quiz" toggle shall shuffle question order and option order. | Medium |

## FR6 — Exam Mode

| ID | Requirement | Priority |
|---|---|---|
| FR6.1 | The system shall start a countdown timer when the exam begins. | High |
| FR6.2 | The user may navigate freely between questions. | High |
| FR6.3 | The system shall show question status (answered, unanswered, skipped). | High |
| FR6.4 | No feedback shall be shown during the exam. | Critical |
| FR6.5 | The user may skip questions. | Medium |
| FR6.6 | The exam ends when the user submits or time expires. | Critical |
| FR6.7 | The results screen shall show score, time taken, and a review. | Critical |
| FR6.8 | Skipped questions shall be listed separately in the review. | Medium |
| FR6.9 | The user may restart the exam. | Medium |

## FR7 — Quiz Sharing

| ID | Requirement | Priority |
|---|---|---|
| FR7.1 | The owner shall be able to generate a shareable link for any quiz. | High |
| FR7.2 | The recipient shall open the link and click "Import Copy" to add the quiz to their library. | High |
| FR7.3 | The imported copy shall be independent — changes to the original do not affect the copy. | Critical |
| FR7.4 | The owner may revoke the share link at any time (prevents new imports). | Medium |

## FR8 — Question Reporting

| ID | Requirement | Priority |
|---|---|---|
| FR8.1 | The user shall be able to report a question from practice or review screens. | Medium |
| FR8.2 | The report shall include a reason (incorrect answer, formatting, typo, other). | Medium |
| FR8.3 | The report shall be sent to the quiz owner. | Medium |
| FR8.4 | The owner shall be able to view and manage received reports. | Low |

## FR9 — User Settings

| ID | Requirement | Priority |
|---|---|---|
| FR9.1 | The user shall be able to change their display name. | Medium |
| FR9.2 | The user shall be able to toggle between light and dark themes. | Low |
| FR9.3 | The user shall be able to select UI language (English, Uzbek, Russian). | Medium |
| FR9.4 | The user shall be able to view their AI credit balance and next refresh date. | High |
| FR9.5 | The user shall be able to delete their account and all associated data. | High |

## FR10 — AI Credits

| ID | Requirement | Priority |
|---|---|---|
| FR10.1 | AI operations (PDF parsing, quiz generation) shall consume credits. | High |
| FR10.2 | Credits shall be refreshed automatically every 15 days. | High |
| FR10.3 | The system shall reject AI operations with a clear message if credits are insufficient. | High |

## FR11 — Telegram Bot Notifications

| ID | Requirement | Priority |
|---|---|---|
| FR11.1 | The bot shall notify the user when a PDF has finished parsing. | Medium |
| FR11.2 | The bot shall support admin-initiated news broadcasts. | Low |
| FR11.3 | Notifications shall be sent via the Telegram Bot API. | Medium |

## FR12 — Localisation

| ID | Requirement | Priority |
|---|---|---|
| FR12.1 | The UI shall be available in English, Uzbek, and Russian. | Medium |
| FR12.2 | Quiz content shall always remain in its original language regardless of UI language. | Critical |
| FR12.3 | Language selection shall be available in user settings. | Medium |
