# UI/UX

## Screens

All screens follow a clean, modern, minimal design with one primary action per view. The interface supports English, Uzbek, and Russian.

---

### Login Screen

**Purpose:** Authenticate the user via Telegram.

**Components:**
- Telegram login button
- Brief description of the application (one sentence)

**Empty states:** N/A

**Error states:**
- Authentication failed: error message with retry

---

### Library Screen

**Purpose:** Main hub — browse and manage all quizzes.

**Components:**
- Tree-style list view with expandable folders and quiz items
- Upload button
- AI generate button
- Search bar
- Sort/filter controls

**Empty states:**
- First visit: "Upload your first PDF" or "Generate your first quiz" CTA

**Error states:**
- Failed to load library: retry button
- Upload failure: error toast with retry

**Navigation:**
- Expand/collapse folders
- Click a quiz to open its overview
- Right-click for context menu (rename, move, delete, share)

---

### Quiz Overview Screen

**Purpose:** Show quiz details, configure settings, and select a mode.

**Components:**
- Quiz title and metadata (question count, source, created date)
- Randomize Quiz toggle
- Practice Mode button
- Exam Mode button (with duration selector)
- Share button
- Delete button
- Question preview list (scrollable)

**Empty states:** N/A (quiz always has questions)

**Error states:**
- Failed to load quiz: retry button

**Navigation:**
- Click a mode button to start
- Click back to return to library

---

### Practice Screen

**Purpose:** Answer questions one by one with immediate feedback.

**Components:**
- Progress bar (question X of Y)
- Question text
- Answer options (clickable)
- Submit button
- Skip button
- Feedback area (after submission): red X or green tick with correct answer displayed
- Next button (appears after answering)
- Report question button (flag icon)
- Quit button

**Empty states:** N/A

**Error states:**
- Failed to load question: retry button
- Network error on submit: auto-retry with toast

**Navigation:**
- Linear progression through questions
- Cannot go back
- Quit returns to quiz overview (session is saved for resume)

---

### Exam Screen

**Purpose:** Simulate a timed exam.

**Components:**
- Timer (countdown)
- Question navigation (prev/next)
- Question text
- Answer options
- Skip button
- Submit exam button
- Question status indicators (answered, unanswered, skipped)

**Empty states:** N/A

**Error states:**
- Timer desync: banner notification
- Submit failure: auto-retry

**Navigation:**
- Can navigate freely between questions
- Submit ends the exam

---

### Results Screen

**Purpose:** Show performance after completing a quiz.

**Components:**
- Score (X / Y correct)
- Percentage
- Time taken (exam mode)
- Question review list (expand each to see answer and correct answer)
- In practice mode: "Retry Incorrect" button
- "Restart" button (always available)
- "Back to Library" button

**Empty states:** N/A

**Error states:** N/A

**Special:**
- In exam mode, skipped questions are shown in a separate section at the end of the review list.

---

### Settings Screen

**Purpose:** Manage user profile and preferences.

**Components:**
- Display name (editable, defaults to Telegram name)
- Theme toggle (light / dark)
- Language selector (English, Uzbek, Russian)
- AI credits display (current balance, next refresh date)
- Delete account button (with confirmation)

**Empty states:** N/A

**Error states:**
- Save failure: error toast with retry

**Navigation:**
- Back button to library
