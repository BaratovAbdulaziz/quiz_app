# User Personas

## Aziz — The Exam-Prep Student

**Age:** 21
**Occupation:** 3rd-year medical student
**Location:** Tashkent, Uzbekistan
**Tech comfort:** Moderate — uses Telegram daily, comfortable with web apps

**Motivation:** His professors distribute past exam questions as PDFs. He currently reads them repeatedly, but scores don't improve because he memorises positions rather than answers.

**Pain points:**
- Spends hours re-reading PDFs without active recall
- Has no way to track which topics he's weak on
- Wastes time manually covering answers to test himself
- Studies with friends but has no easy way to share quizzes

**Goal:** Pass his biochemistry exam by practising until every question is correct.

**Behaviour:** Studies in 20–30 minute bursts between classes. Uses Telegram constantly. Studies on his phone during commutes and on his laptop at home.

---

## Malika — The Entrance Exam Candidate

**Age:** 17
**Occupation:** High school student, applying to university
**Location:** Samarkand, Uzbekistan
**Tech comfort:** High — grew up with smartphones, uses Telegram for everything

**Motivation:** She needs to score high on the national university entrance exam. Her tutor gives her topic lists but not enough practice questions.

**Pain points:**
- Doesn't have enough practice questions for some subjects
- Bored by static textbooks
- Wants to know her progress day by day
- Gets anxious about exams and wants to simulate real conditions

**Goal:** Score in the top 5% of the national entrance exam.

**Behaviour:** Studies 2–3 hours every evening. Uses her phone mainly. Likes seeing progress numbers go up. Gets discouraged if she can't track improvement.

---

## Rustam — The Certification Seeker

**Age:** 29
**Occupation:** Software developer
**Location:** Remote / Tashkent
**Tech comfort:** High — works in tech

**Motivation:** Studying for the AWS Solutions Architect certification. Has official study guides and practice question PDFs but wants a more interactive way to drill.

**Pain points:**
- Certification material is dry and text-heavy
- Needs to practice hundreds of questions across multiple domains
- Wants to focus on weak areas
- Prefers typing "photosynthesis topic" over uploading a file

**Goal:** Pass the AWS certification on his first attempt.

**Behaviour:** Studies during lunch breaks and evenings. Uses his laptop. Willing to pay for AI credits if the free tier runs out. Expects fast, reliable tooling.

---

## Dilnoza — The Teacher

**Age:** 35
**Occupation:** High school biology teacher
**Location:** Bukhara, Uzbekistan
**Tech comfort:** Low—moderate — uses Telegram for messaging, not much else

**Motivation:** She wants her students to practise more but can't create interactive quizzes herself. She has question banks in Word and PDF format.

**Pain points:**
- Spends hours manually making paper quizzes
- Can't easily share practice material with students digitally
- No insight into which questions her students struggle with
- Technology feels intimidating

**Goal:** Give her students an easy way to practise biology questions on their phones.

**Behaviour:** Prepares material on her laptop during planning time. Relies on her tech-savvy students for help. Needs the simplest possible interface.

---

# Real-Life Scenarios

## Scenario 1: Last-Minute Exam Cramming

Aziz has a biochemistry exam tomorrow. His professor shared a 40-page PDF with 200 past exam questions. He uploads it to the app at 10 PM. The AI parses it in 15 seconds. He starts Practice Mode immediately. At 11:30 PM he has gone through all 200 questions, identified 45 he got wrong, and retries those. By midnight he feels confident.

## Scenario 2: Commute Studying

Malika has a 30-minute bus ride to school. She opens the bot, taps the menu button, and opens her biology quiz. She does 10 questions in Practice Mode during the ride. Two questions have explanations she reads carefully. She arrives at school having actively learned, not just scrolled social media.

## Scenario 3: Topic Deep-Dive

Rustam is studying AWS IAM policies. He already read the docs but wants to test himself. He opens the app, clicks "Generate", types "AWS IAM policies and roles". The AI asks "Should questions focus on IAM policy evaluation logic or identity-based vs resource-based policies?" He picks evaluation logic. The AI generates 15 questions. He drills them in Exam Mode with a 10-minute timer.

## Scenario 4: Teacher Sharing Material

Dilnoza has a Word document with 50 biology questions about cell division. She converts it to PDF, uploads it, and the AI parses it into a quiz. She clicks Share, gets a link, and sends it to her class group on Telegram. Her students open the link, import a copy, and start practising. Dilnoza receives reports from students about a question with a wrong answer and fixes it.

## Scenario 5: Group Study Session

Aziz and three classmates are studying together. Aziz shares a quiz link via Telegram. Each friend imports a copy. They all take the quiz individually on their phones, then compare scores. The friend who scored lowest retires the incorrect questions until they catch up.

## Scenario 6: First Day on the App

Malika opens the bot for the first time. She clicks Start. The bot welcomes her and shows a menu button. She taps it and lands in an empty library with "Upload your first PDF" and "Generate your first quiz" buttons. She doesn't have a PDF ready, so she clicks Generate, types "Photosynthesis", and 8 seconds later her first quiz appears. She's practising within 60 seconds of opening the bot.

---

# User Stories

## Authentication & Onboarding

- As a new user, I want to log in with Telegram so that I don't have to create yet another account.
- As a returning user, I want to open the bot and tap the menu button so that I can reach my quizzes in one tap.
- As a user, I want the app to remember me so that I don't have to log in every time.

## PDF Upload & Parsing

- As a student, I want to upload a PDF so that my exam questions become interactive.
- As a user, I want to see upload progress so that I know the system is working.
- As a user, I want a clear error message if the PDF can't be parsed so that I know what went wrong.
- As a user, I want to be notified via Telegram when my quiz is ready so that I don't have to wait staring at the screen.

## AI Quiz Generation

- As a student, I want to type a topic and get a quiz so that I can practise subjects I don't have PDFs for.
- As a user, I want the AI to ask clarifying questions if my topic is vague so that the quiz is relevant.
- As a user, I want to see how many AI credits I have so that I know if I can generate a quiz.

## Library

- As a user, I want to organise quizzes into folders so that I can keep subjects separate.
- As a user, I want to search my quizzes so that I can find what I need quickly.
- As a user, I want new quizzes to appear in the root so that I don't have to choose a folder immediately.

## Practice Mode

- As a student, I want immediate feedback after each answer so that I learn from mistakes right away.
- As a user, I want to skip hard questions so that I don't get stuck.
- As a user, I want to retry only the questions I got wrong so that I focus on my weak areas.
- As a user, I want to resume where I left off so that I can study in short sessions.

## Exam Mode

- As a student, I want a timed simulation so that I can practise exam conditions.
- As a user, I want to see which questions I skipped so that I know what to review.
- As a user, I want to see my score and time at the end so that I can measure my performance.

## Sharing

- As a user, I want to share a quiz with a link so that my friends can practise too.
- As a user, I want to import a shared quiz so that I get my own copy to edit and practise.

## Reporting

- As a user, I want to report an incorrect question so that the owner can fix it.
- As a quiz owner, I want to see reports on my quizzes so that I can correct mistakes.

## Settings

- As a user, I want to change the app language so that I can use it in my preferred language.
- As a user, I want to switch to dark mode so that studying at night is easier on my eyes.
- As a user, I want to see my AI credit balance so that I know when I need to wait for a refresh.
- As a user, I want to delete my account if I no longer need the app.

## Notifications

- As a user, I want the bot to tell me when my quiz is ready so that I don't have to keep checking.
- As a user, I want important updates from the platform so that I know about new features.
