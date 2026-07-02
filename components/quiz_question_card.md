# Quiz Question Card

## Source

Custom component — no external package needed.

## Purpose

The core quiz UI element. Displays one question at a time with selectable answer options, immediate feedback in practice mode, and navigation controls.

## Dependencies

- `lucide-react` (already installed)

## Props

| Prop | Type | Description |
|---|---|---|
| `question` | `{ text, options, correctIndex, explanation? }` | The question data |
| `questionNumber` | `number` | Current position in quiz |
| `totalQuestions` | `number` | Total questions in quiz |
| `mode` | `"practice" \| "exam"` | Determines feedback behavior |
| `onAnswer` | `(index, isCorrect) => void` | Called when user selects an option |
| `onNext` | `() => void` | Advances to next question |
| `onSkip` | `() => void` | Skips current question |
| `onReport?` | `() => void` | Reports question to owner |

## Behavior

- **Practice mode** — select an option → immediate green/red feedback with optional explanation → click Next
- **Exam mode** — select an option → no feedback → click Next (or Skip)
- Options are labelled A, B, C, D
- Correct answer highlighted green, wrong selection highlighted red
- Skip button available before answering
- After last question, Next button reads "View Results"

## Usage

```tsx
import QuizQuestionCard from "@/components/ui/quiz-question-card"

<QuizQuestionCard
  question={{
    text: "What is the capital of France?",
    options: ["London", "Paris", "Berlin", "Madrid"],
    correctIndex: 1,
    explanation: "Paris has been the capital of France since the 10th century."
  }}
  questionNumber={1}
  totalQuestions={10}
  mode="practice"
  onAnswer={(index, correct) => console.log(index, correct)}
  onNext={() => console.log("next")}
  onSkip={() => console.log("skipped")}
/>
```

## Integration Notes

- Create in `components/ui/quiz-question-card.tsx` when ready
- Uses Tailwind CSS for styling, no additional dependencies
- Supports both light and dark modes via CSS variables
