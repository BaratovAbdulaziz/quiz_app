import { NextRequest, NextResponse } from "next/server"
import { execSync } from "child_process"
import { writeFileSync, existsSync, readFileSync } from "fs"
import { join, resolve, dirname } from "path"

const ADMIN_PASSWORD = "2312"

function findProjectRoot(start: string): string {
  let dir = resolve(start)
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "turbo.json"))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return resolve(start, "..")
}

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON" } }, { status: 400 })
  }
  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid password" } }, { status: 401 })
  }

  const { action } = body
  const projectRoot = findProjectRoot(process.cwd())
  const botDir = join(projectRoot, "apps", "bot")

  if (!existsSync(botDir)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Bot directory not found" } }, { status: 500 })
  }

  if (action === "start") {
    try {
      execSync("pm2 start ecosystem.config.json --only quiz-app-bot", { timeout: 15000, cwd: botDir, stdio: "pipe" })
      return NextResponse.json({ data: { status: "started" } })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      return NextResponse.json({ error: { code: "BOT_ERROR", message: msg } }, { status: 500 })
    }
  }

  if (action === "stop") {
    try {
      execSync("pm2 stop quiz-app-bot", { timeout: 10000, stdio: "pipe" })
      return NextResponse.json({ data: { status: "stopped" } })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      return NextResponse.json({ error: { code: "BOT_ERROR", message: msg } }, { status: 500 })
    }
  }

  return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Unknown action" } }, { status: 400 })
}

export async function GET() {
  try {
    const out = execSync("pm2 show quiz-app-bot --no-color 2>/dev/null || echo 'not found'", { timeout: 5000, stdio: "pipe" })
    const status = out.toString().includes("status") ? "running" : "stopped"
    return NextResponse.json({ data: { status } })
  } catch {
    return NextResponse.json({ data: { status: "stopped" } })
  }
}
