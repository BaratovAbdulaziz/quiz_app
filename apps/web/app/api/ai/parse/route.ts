import { execSync } from "child_process"
import { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { files, quizzes, questions, notifications, users } from "@quiz-app/shared"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { parsePdfQuestions } from "@/lib/openrouter"
import { withAuth } from "@/middleware/auth"

const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY
const R2_SECRET_KEY = process.env.R2_SECRET_KEY
const R2_BUCKET = process.env.R2_BUCKET || "quiz-app-files"

const r2 = R2_ENDPOINT && R2_ACCESS_KEY && R2_SECRET_KEY
  ? new S3Client({ region: "auto", endpoint: R2_ENDPOINT, credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY }, forcePathStyle: true })
  : null

async function getFileBuffer(storageKey: string): Promise<Buffer> {
  if (!r2) throw new Error("R2 not configured")
  const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: storageKey }))
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as any) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function extractPdfText(buffer: Buffer): string {
  return execSync("pdftotext - -", { input: buffer, maxBuffer: 50 * 1024 * 1024 }).toString()
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof Response) return auth

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const { fileId, title, questionsPerQuiz, folderId } = await request.json()

        const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1)
        if (!file || file.userId !== auth.user.userId) {
          send("error", { code: "NOT_FOUND", message: "File not found" })
          controller.close()
          return
        }

        const [user] = await db.select().from(users).where(eq(users.id, auth.user.userId)).limit(1)
        if (!user || user.credits < 5) {
          send("error", { code: "INSUFFICIENT_CREDITS", message: "Insufficient AI credits" })
          controller.close()
          return
        }

        send("log", { message: "Downloading file from storage..." })
        const fileBuffer = await getFileBuffer(file.storageKey)

        send("log", { message: "Extracting text from PDF..." })
        const pdfText = extractPdfText(fileBuffer)
        send("log", { message: `Extracted ${pdfText.length.toLocaleString()} characters` })

        send("log", { message: "Sending to AI for question extraction..." })
        const result = await parsePdfQuestions(pdfText, (msg) => send("log", { message: msg }))

        const allQuestions = result.questions
        if (allQuestions.length === 0) {
          send("error", { code: "NO_QUESTIONS", message: "No questions could be extracted from the PDF" })
          controller.close()
          return
        }

        const perQuiz = typeof questionsPerQuiz === "number" && questionsPerQuiz > 0 ? questionsPerQuiz : allQuestions.length
        const baseTitle = title || file.originalName.replace(/\.pdf$/i, "")
        const totalQuizzes = Math.ceil(allQuestions.length / perQuiz)
        const created: typeof quizzes.$inferSelect[] = []

        send("log", { message: `Creating ${totalQuizzes} quiz(es) with ${allQuestions.length} total questions...` })

        for (let part = 0; part < totalQuizzes; part++) {
          const chunk = allQuestions.slice(part * perQuiz, (part + 1) * perQuiz)
          const quizTitle = totalQuizzes > 1 ? `${baseTitle} (${part + 1}/${totalQuizzes})` : baseTitle

          const [quiz] = await db.insert(quizzes).values({
            userId: auth.user.userId,
            title: quizTitle,
            description: `Parsed from ${file.originalName}`,
            source: "uploaded_pdf",
            sourceFileId: fileId,
            folderId: folderId || null,
            questionCount: chunk.length,
          }).returning()

          for (let i = 0; i < chunk.length; i++) {
            const q = chunk[i]
            await db.insert(questions).values({
              quizId: quiz.id,
              text: q.text,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation || null,
              order: i,
            })
          }

          created.push(quiz)
        }

        await db.update(users).set({ credits: user.credits - 5 }).where(eq(users.id, auth.user.userId))

        for (const quiz of created) {
          await db.insert(notifications).values({
            userId: auth.user.userId,
            message: `Your quiz "${quiz.title}" is ready. Open in app.`,
            type: "quiz_ready",
          })
        }

        send("result", { quizzes: created })
        controller.close()
      } catch (error) {
        send("error", {
          code: "PARSE_FAILED",
          message: error instanceof Error ? error.message : "Failed to parse PDF",
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
