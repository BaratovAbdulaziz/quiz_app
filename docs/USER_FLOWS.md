# User Flows

## Login

1. User opens the application.
2. Login screen displays the Telegram login button.
3. User clicks the button and is redirected to Telegram.
4. User authorizes the application.
5. System creates an account automatically if new, or logs in if returning.
6. User is redirected to the library.
7. If authentication fails, an error message is shown.

## Upload PDF

1. User navigates to the library.
2. User clicks the upload button.
3. File picker opens (PDF only).
4. User selects a PDF file.
5. System uploads the file and shows a progress indicator.
6. AI parses the PDF and extracts questions.
7. System creates a new quiz entry in the library root folder.
8. Success notification is displayed.
9. If parsing fails, an error message with a retry option is shown.

## Generate AI Quiz

1. User navigates to the library.
2. User clicks the AI generate button.
3. Modal appears with a topic input field and optional settings.
4. User enters a topic (e.g. "Photosynthesis", "World War II").
5. If needed, AI asks follow-up clarification questions.
6. User responds to any AI questions.
7. AI generates the quiz and shows a loading state.
8. New quiz appears in the library root folder.
9. If generation fails (e.g. insufficient credits), an error message is shown.
10. Credits are deducted upon successful generation.

## Start Practice Mode

1. User opens a quiz from the library.
2. Quiz overview screen shows title, question count, Randomize toggle, and mode buttons.
3. User clicks "Practice Mode".
4. First question is displayed one at a time.
5. User selects an answer or clicks Skip.
6. If answered, immediate feedback is shown (red X or green tick with correct answer).
7. User clicks "Next" to proceed.
8. After the final question, a results screen shows score, review, Retry Incorrect, and Restart options.

## Start Exam Mode

1. User opens a quiz from the library.
2. Quiz overview screen shows settings and mode buttons.
3. User configures exam duration and Randomize toggle.
4. User clicks "Exam Mode".
5. A countdown timer starts.
6. Questions are presented with prev/next navigation and a Skip button.
7. No feedback is given during the exam.
8. User submits when finished or time expires.
9. Results screen shows score, time taken, and a review with skipped questions listed separately.

## Share Quiz

1. User opens a quiz.
2. User clicks the share button.
3. System generates a shareable link.
4. Link is copied to clipboard automatically.
5. User sends the link to a recipient.
6. Recipient opens the link.
7. Recipient clicks "Import Copy" to add the quiz to their own library.
8. The imported copy is independent of the original.

## Retry Incorrect (Practice Mode Only)

1. User completes a practice session.
2. Results screen shows "Retry Incorrect" button.
3. User clicks the button.
4. A new practice session begins containing only the previously incorrect questions.
5. After completing, results are shown for the retry session.

## Restart Quiz

1. User is on the results screen or active session.
2. User clicks "Restart".
3. Confirmation prompt appears.
4. User confirms.
5. Quiz restarts from the beginning with reshuffled questions (if Randomize is enabled).

## Report Question

1. User is viewing a question in practice or review mode.
2. User clicks the report button (flag icon).
3. A modal appears with reason options (incorrect answer, formatting, typo, other).
4. User selects a reason and optionally adds a comment.
5. User submits the report.
6. The report is sent to the quiz owner for review.
