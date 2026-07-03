import { NextRequest, NextResponse } from "next/server"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname, resolve } from "path"

const ADMIN_PASSWORD = "2312"

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

function parseEnv(content: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return vars
}

function mask(val: string): string {
  if (!val) return ""
  if (val.length <= 8) return "********"
  return val.slice(0, 4) + "********" + val.slice(-4)
}

export async function GET() {
  const projectRoot = findProjectRoot(process.cwd())
  const webEnvPath = join(projectRoot, "apps", "web", ".env")
  const botEnvPath = join(projectRoot, "apps", "bot", ".env")

  const webVars = existsSync(webEnvPath) ? parseEnv(readFileSync(webEnvPath, "utf-8")) : {}
  const botVars = existsSync(botEnvPath) ? parseEnv(readFileSync(botEnvPath, "utf-8")) : {}

  return NextResponse.json({
    data: {
      web: {
        DATABASE_URL: mask(webVars.DATABASE_URL || ""),
        JWT_SECRET: mask(webVars.JWT_SECRET || ""),
        TELEGRAM_BOT_TOKEN: mask(webVars.TELEGRAM_BOT_TOKEN || ""),
        OPENROUTER_API_KEY: mask(webVars.OPENROUTER_API_KEY || ""),
        R2_ENDPOINT: mask(webVars.R2_ENDPOINT || ""),
        R2_ACCESS_KEY: mask(webVars.R2_ACCESS_KEY || ""),
        R2_SECRET_KEY: mask(webVars.R2_SECRET_KEY || ""),
        R2_BUCKET: webVars.R2_BUCKET || "",
        APP_URL: webVars.APP_URL || "",
      },
      bot: {
        BOT_TOKEN: mask(botVars.BOT_TOKEN || ""),
        DATABASE_URL: mask(botVars.DATABASE_URL || ""),
        WEB_APP_URL: botVars.WEB_APP_URL || "",
      },
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { password, ...body } = await request.json()
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid password" } }, { status: 401 })
    }

    const projectRoot = findProjectRoot(process.cwd())
    const webEnvPath = join(projectRoot, "apps", "web", ".env")
    const botEnvPath = join(projectRoot, "apps", "bot", ".env")

    const allowedWeb = ["DATABASE_URL", "JWT_SECRET", "TELEGRAM_BOT_TOKEN", "OPENROUTER_API_KEY", "R2_ENDPOINT", "R2_ACCESS_KEY", "R2_SECRET_KEY", "R2_BUCKET", "APP_URL"]
    const allowedBot = ["BOT_TOKEN", "DATABASE_URL", "WEB_APP_URL"]

    if (body.web) {
      const existing = existsSync(webEnvPath) ? parseEnv(readFileSync(webEnvPath, "utf-8")) : {}
      for (const key of allowedWeb) {
        if (body.web[key] !== undefined) {
          existing[key] = body.web[key]
        }
      }
      const content = Object.entries(existing)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n"
      writeFileSync(webEnvPath, content, "utf-8")
    }

    if (body.bot) {
      const existing = existsSync(botEnvPath) ? parseEnv(readFileSync(botEnvPath, "utf-8")) : {}
      for (const key of allowedBot) {
        if (body.bot[key] !== undefined) {
          existing[key] = body.bot[key]
        }
      }
      const content = Object.entries(existing)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n"
      writeFileSync(botEnvPath, content, "utf-8")
    }

    return NextResponse.json({ data: { success: true } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 })
  }
}
