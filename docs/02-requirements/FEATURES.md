# Features

## Feature Inventory

| Name | Description | Status | Priority | Dependencies |
|---|---|---|---|---|
| Telegram Login | Authenticate via Telegram login widget | MVP | Critical | Telegram Bot API |
| Auto-Account Creation | Account created automatically on first Telegram login | MVP | Critical | Telegram login |
| PDF Upload | Upload PDF files for AI parsing | MVP | Critical | Storage, AI service |
| AI PDF Parsing | Extract multiple-choice questions from PDF | MVP | Critical | AI service |
| AI Quiz Generation | Generate quiz from topic prompt | MVP | High | AI service, credits |
| AI Follow-Up Questions | AI asks clarifying questions during generation if needed | MVP | Medium | AI service |
| AI Credits System | Credits consumed for AI operations, refreshed every 15 days | MVP | High | AI service |
| Crossword Generator (AI) | Generate crossword from topic prompt via AI | MVP | Medium | AI service, crosswords |
| Crossword Generator (Manual) | Create crossword by entering clues and answers manually | MVP | Medium | Crosswords |
| Crossword Solving | Interactive crossword solve screen with per-clue inputs and answer checking | MVP | Medium | Crosswords |
| Crossword Library | Crosswords displayed alongside quizzes in library tree | MVP | Low | Crosswords |
| Crossword Sharing | Share crosswords by link — recipient imports a copy | MVP | Medium | API, crosswords |
| Shared Quiz Taking | Public page at /shared/[token] to take a quiz directly without importing | MVP | Medium | share |
| Teachers Mode (Analytics) | Dashboard showing attempt count, scores, percentages for shared content | MVP | Low | share, sharedAttempts |
| Answer Key (Quiz) | Toggle on quiz overview that reveals all correct answers for review | MVP | Low | Quiz engine |
| Answer Key (Crossword) | Toggle on crossword screen that fills in all answers in the grid | MVP | Low | Crosswords |
| Practice Mode | Interactive quiz with immediate feedback (red X / green tick) | MVP | Critical | Quiz engine |
| Skip Question | Skip a question during practice or exam | MVP | Medium | Quiz engine |
| Retry Incorrect | Retry only incorrectly answered questions (practice mode) | MVP | Low | Quiz engine |
| Restart Quiz | Restart quiz from the beginning at any time | MVP | Low | Quiz engine |
| Randomize Quiz | Shuffle question and answer option order | MVP | Low | Quiz engine |
| Resume Practice | Resume an incomplete practice session | MVP | Medium | Quiz engine |
| Exam Mode | Timed non-interactive exam simulation | MVP | High | Quiz engine |
| Skipped Questions List | Show skipped questions separately in exam results | MVP | Low | Quiz engine |
| Quiz Library | File-explorer-style tree list with folders | MVP | Critical | Database |
| Quiz Sharing | Share by link — recipient imports a copy | MVP | Medium | API |
| Report Question | Report incorrect answer to quiz owner | MVP | Low | Database |
| User Settings | Profile and preferences | MVP | Medium | Database |
| UI Languages | English, Uzbek, Russian | MVP | Medium | i18n framework |
| Dark Mode | Light and dark theme toggle | MVP | Low | UI framework |
| Questions-Per-Quiz Split | Configure how many questions per quiz when uploading PDF | MVP | Medium | PDF parsing |
| Upload Modal | Pre-upload popup with filename, question count, progress bar | MVP | Medium | PDF upload |
| Admin Panel | Hidden admin panel for config, users, bot management, API testing | MVP | Low | Admin API |
| Test Users Flag | Exclude test accounts from admin panel via is_test_user column | MVP | Low | Database |
| Tokens Display | Show user credits as tokens in admin panel | MVP | Low | Admin API |
| Test API | Test AI generation from admin panel with topic input | MVP | Low | AI service |
| MinIO Storage | Local S3-compatible file storage for development | MVP | Low | Infrastructure |
| Progress Tracking | Per-quiz score and history | V1.1 | High | Database |
| Spaced Repetition | Algorithmic review scheduling | V1.1 | Medium | Quiz engine |
| Bookmarking | Save questions for later review | V1.1 | Low | Database |
| Bulk PDF Upload | Upload multiple PDFs at once | V1.2 | Medium | Storage, AI service |
| Batch Editing | Edit multiple quiz questions at once | V1.2 | Medium | UI |
| Advanced Search | Search across entire library | V1.2 | Medium | Search index |
| Export Quizzes | Export to PDF, CSV | V1.2 | Low | Formatting |
| Public Quiz Gallery | Browse and search shared quizzes | V1.2 | Medium | API, search |
| Team Classrooms | Groups with shared libraries | V2 | High | Permissions |
| Student Dashboards | Teacher-facing progress views | V2 | High | Analytics |
| Adaptive Difficulty | AI adjusts question difficulty | V2 | Medium | AI service |
| AI Explanations | AI-generated answer explanations | V2 | Medium | AI service |
| Public API | Third-party integration endpoints | V2 | Low | API gateway |
| Mobile Apps | Native iOS and Android | V2 | High | Cross-platform framework |
