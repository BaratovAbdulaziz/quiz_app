import { NextRequest, NextResponse } from "next/server"
import { execSync } from "child_process"
import { writeFileSync, existsSync, readFileSync } from "fs"
import { join, resolve, dirname } from "path"

const ADMIN_PASSWORD = "2312"
const BOT_ENV_PATH = join(resolve(process.cwd(), ".."), "bot", ".env")

function findProjectRoot(start: string): string {
  let dir = resolve(start)
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "turbo.json")) || existsSync(join(dir, "package.json"))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return start
}

async function verifyPassword(request: NextRequest) {
  try {
    const { password } = await request.json()
    if (password !== ADMIN_PASSWORD) return false
    return true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const authed = await verifyPassword(request)
  if (!authed) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid password" } }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  if (action === "start") {
    try {
      execSync("pm2 start ../../deploy/ecosystem.config.json --only quiz-app-bot", { timeout: 10000, cwd: join(process.cwd(), "..", "bot"), stdio: "pipe" })
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

  if (action === "token") {
    const { token } = body
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Token is required" } }, { status: 400 })
    }
    try {
      const projectRoot = findProjectRoot(process.cwd())
      const botEnvPath = join(projectRoot, "apps", "bot", ".env")
      const dir = dirname(botEnvPath)
      if (!existsSync(dir)) {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Bot directory not found" } }, { status: 500 })
      }

      let envContent = ""
      if (existsSync(botEnvPath)) {
        envContent = readFileSync(botEnvPath, "utf-8")
        envContent = envContent.replace(/^BOT_TOKEN=.*$/m, `BOT_TOKEN=${token}`)
      }
      if (!envContent.includes("BOT_TOKEN=")) {
        envContent += `\nBOT_TOKEN=${token}\n`
      }
      writeFileSync(botEnvPath, envContent, "utf-8")
      return NextResponse.json({ data: { success: true } })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 })
    }
  }

  return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Unknown action" } }, { status: 400 })
}

export async function GET() {
  try {
    const out = execSync("pm2 show quiz-app-bot --no-color 2>/dev/null || echo 'not found'", { timeout: 5000, stdio: "pipe" })
    const status = out.toString().includes("status") ? "running" : "stopped"

    const projectRoot = findProjectRoot(process.cwd())
    const botEnvPath = join(projectRoot, "apps", "bot", ".env")
    let token = ""
    if (existsSync(botEnvPath)) {
      const match = readFileSync(botEnvPath, "utf-8").match(/^BOT_TOKEN=(.+)$/m)
      if (match) token = match[1]
    }

    return NextResponse.json({ data: { status, token: token ? `${token.slice(0, 8)}...` : "" } })
  } catch {
    return NextResponse.json({ data: { status: "stopped", token: "" } })
  }
}
