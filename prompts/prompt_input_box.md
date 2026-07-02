# Prompt Input Box — `ChatGPTInput`

## Purpose

A dynamic, AI-themed input component for submitting prompts. Used as the primary input interface for AI quiz generation and topic search within the app.

## Location

`components/ui/prompt-input-dynamic-grow.tsx`

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `placeholder` | string | `"Ask a question..."` | Input placeholder text |
| `onSubmit` | `(value: string) => void` | — | Called with trimmed input on submit |
| `disabled` | boolean | `false` | Disables input and submit |
| `glowIntensity` | number | `0.4` | Glow effect intensity (0.1–1.0) |
| `expandOnFocus` | boolean | `true` | Expands width on focus |
| `animationDuration` | number | `500` | Animation duration in ms |
| `textColor` | string | `"#0A1217"` | Text color |
| `backgroundOpacity` | number | `0.15` | Background opacity (0.1–1.0) |
| `showEffects` | boolean | `true` | Enable glow and ripple effects |
| `menuOptions` | `MenuOption[]` | `["Auto","Max","Search","Plan"]` | Available mode tags |

## Usage

```tsx
import ChatGPTInput from '@/components/ui/prompt-input-dynamic-grow'

function MyPage() {
  const handleSubmit = (value: string) => {
    console.log('User prompt:', value)
  }

  return (
    <ChatGPTInput
      placeholder="Generate quiz about..."
      onSubmit={handleSubmit}
      menuOptions={["Auto", "Search"]}
    />
  )
}
```

## States

- **Default** — clean input with placeholder, plus button for mode menu
- **Focused** — expands width, glow effects activate, cursor-following gradient
- **Disabled** — greyed out, no interaction
- **With modes selected** — selected mode tags shown below input row, width locked to expanded size
- **Submit** — Enter (no Shift) submits; Shift+Enter inserts newline

## Dependencies

- `lucide-react` (Plus icon)
- React (useState, useRef, useEffect, useCallback, useMemo, memo, createContext, useContext)

## Internal Structure

- `ChatInputContext` — provides mouse position, ripples, and effect settings to child components
- `InputArea` — auto-growing textarea with send button
- `MenuButton` + `OptionsMenu` — dropdown for selecting AI mode options
- `SelectedOptions` + `OptionTag` — inline tags for active modes
- `GlowEffects` — border glow, cursor gradient, shimmer, sweep animations
- `RippleEffects` — click ripple animation circles
- `SendButton` — arrow-up submit button

## Related

- See `docs/AI.md` for AI prompt strategy
- See `docs/QUIZZES.md` for quiz generation flow
