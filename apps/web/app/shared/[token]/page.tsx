"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { ArrowLeft, Check, X } from "lucide-react"
import Logo from "@/app/Logo"
import { cn } from "@/lib/utils"
import type { Id } from "@/convex/_generated/dataModel"

export default function SharedPage() {
  const params = useParams()
  const token = params.token as string
  const data = useQuery(api.share.getByToken, token ? { token } : "skip")
  const recordAttempt = useMutation(api.sharedAttempts.record)
  const [name, setName] = useState("")
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (data && !started && !submitted) {
      setName(`Guest-${Math.random().toString(36).slice(2, 6)}`)
    }
  }, [data, started, submitted])

  if (!data) {
    return (
      <div className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline flex items-center justify-center">
        <div className="text-center">
          <p className="text-body-sm text-steel mb-2">Loading shared content...</p>
          <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  if (!data.link || !data.link.active) {
    return (
      <div className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-heading-5 text-ink mb-2">Link not found</p>
          <p className="text-body-sm text-steel">This share link may have expired or been removed.</p>
        </div>
      </div>
    )
  }

  const { link, itemType } = data

  if (itemType === "crossword") {
    const crossword = data.crossword
    const clues = data.clues ?? []
    const across = clues.filter((c: any) => c.direction === "across")
    const down = clues.filter((c: any) => c.direction === "down")

    return (
      <div className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline flex flex-col">
        <header className="flex items-center gap-3 px-6 h-14 hairline-bottom">
          <Logo size={28} />
          <h2 className="text-heading-5 truncate flex-1">{crossword?.title ?? "Crossword"}</h2>
        </header>
        <div className="px-6 py-6 flex-1 overflow-y-auto">
          <p className="text-body-sm text-steel mb-4 text-center">{crossword?.description ?? "Shared crossword"}</p>
          <div className="grid grid-cols-2 gap-4">
            {across.length > 0 && (
              <div>
                <p className="micro-uppercase text-steel mb-2">Across</p>
                <div className="space-y-1.5">
                  {across.map((c: any) => (
                    <div key={`across-${c.number}`} className="clue-item p-2 rounded-lg border border-transparent">
                      <span className="text-caption font-medium text-steel">{c.number}.</span>
                      <span className="text-caption text-ink ml-1">{c.clue}</span>
                      <span className="text-caption text-brand-green ml-1">({(c.word ?? "").length})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {down.length > 0 && (
              <div>
                <p className="micro-uppercase text-steel mb-2">Down</p>
                <div className="space-y-1.5">
                  {down.map((c: any) => (
                    <div key={`down-${c.number}`} className="clue-item p-2 rounded-lg border border-transparent">
                      <span className="text-caption font-medium text-steel">{c.number}.</span>
                      <span className="text-caption text-ink ml-1">{c.clue}</span>
                      <span className="text-caption text-brand-green ml-1">({(c.word ?? "").length})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const quiz = data.quiz
  const questions = data.questions ?? []

  const handleSubmit = async () => {
    let correct = 0
    questions.forEach((q: any, i: number) => {
      if (answers[i] === q.correctIndex) correct++
    })
    setScore(correct)
    setTotal(questions.length)
    setSubmitted(true)

    try {
      await recordAttempt({
        shareLinkId: link._id as Id<"shareLinks">,
        participantName: name,
        score: correct,
        total: questions.length,
        completed: true,
        data: { answers },
      })
    } catch {}
  }

  if (submitted) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0
    return (
      <div className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline flex flex-col">
        <header className="flex items-center gap-3 px-6 h-14 hairline-bottom">
          <Logo size={28} />
          <h2 className="text-heading-5 truncate flex-1">{quiz?.title ?? "Quiz"}</h2>
        </header>
        <div className="px-6 py-6 flex-1 flex flex-col items-center justify-center text-center">
          <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mb-4", pct >= 70 ? "bg-brand-green-soft/20" : "bg-brand-error/10")}>
            <span className="text-heading-2 font-bold" style={{ color: pct >= 70 ? "#15803d" : "#dc2626" }}>{pct}%</span>
          </div>
          <p className="text-body-md-medium text-ink mb-1">{score} / {total} correct</p>
          <p className="text-body-sm text-steel mb-6">Thanks for participating!</p>
          <div className="space-y-2 w-full max-w-md text-left">
            {questions.map((q: any, i: number) => (
              <div key={i} className="p-3 rounded-lg border border-hairline">
                <p className="text-body-sm text-ink mb-1">{q.text}</p>
                <p className="text-caption" style={{ color: answers[i] === q.correctIndex ? "#15803d" : "#dc2626" }}>
                  {answers[i] === q.correctIndex ? <Check size={14} className="inline" /> : <X size={14} className="inline" />}
                  {" "}Your answer: {answers[i] != null ? q.options[answers[i]] : "None"} {answers[i] !== q.correctIndex && `· Correct: ${q.options[q.correctIndex]}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline flex flex-col">
      <header className="flex items-center gap-3 px-6 h-14 hairline-bottom">
        <Logo size={28} />
        <h2 className="text-heading-5 truncate flex-1">{quiz?.title ?? "Quiz"}</h2>
        <span className="text-caption text-steel">{questions.length} questions</span>
      </header>
      <div className="px-6 py-6 flex-1 overflow-y-auto">
        <div className="mb-4">
          <label className="micro-uppercase text-steel block mb-1">Your Name (optional)</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-input"
            placeholder="Enter your name"
          />
        </div>
        <div className="space-y-4 mb-6">
          {questions.map((q: any, i: number) => (
            <div key={i} className="card-base p-4">
              <p className="text-body-sm-medium text-ink mb-2">{i + 1}. {q.text}</p>
              <div className="space-y-1.5">
                {q.options.map((opt: string, oi: number) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers(a => ({ ...a, [i]: oi }))}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg border text-body-sm transition-all",
                      answers[i] === oi
                        ? "border-primary bg-surface text-ink"
                        : "border-hairline text-steel hover:bg-surface"
                    )}
                  >
                    {String.fromCharCode(65 + oi)}. {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={Object.keys(answers).length < questions.length}
          className="btn-primary w-full"
        >
          Submit Answers
        </button>
      </div>
    </div>
  )
}
