import { NextRequest, NextResponse } from "next/server"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname, resolve } from "path"

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""

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

  const webVars = existsSync(webEnvPath) ? parseEnv(readFileSync(webEnvPath, "utf-8")) : {}

  return NextResponse.json({
    data: {
      TELEGRAM_BOT_TOKEN: mask(webVars.TELEGRAM_BOT_TOKEN || ""),
      APP_URL: webVars.APP_URL || "",
      OPENROUTER_API_KEYS: webVars.OPENROUTER_API_KEYS || "",
      APP_EXPIRES_AT: webVars.APP_EXPIRES_AT || "",
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

    const webEnv = existsSync(webEnvPath) ? parseEnv(readFileSync(webEnvPath, "utf-8")) : {}
    const botEnv = existsSync(botEnvPath) ? parseEnv(readFileSync(botEnvPath, "utf-8")) : {}

    for (const key of ["TELEGRAM_BOT_TOKEN", "APP_URL", "OPENROUTER_API_KEYS", "APP_EXPIRES_AT"]) {
      if (body[key] === undefined) continue
      webEnv[key] = body[key]
    }

    if (body.TELEGRAM_BOT_TOKEN !== undefined) {
      botEnv.BOT_TOKEN = body.TELEGRAM_BOT_TOKEN
    }
    if (body.APP_URL !== undefined) {
      botEnv.API_BASE_URL = body.APP_URL
    }

    const writeEnv = (path: string, vars: Record<string, string>) => {
      const content = Object.entries(vars)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n"
      writeFileSync(path, content, "utf-8")
    }

    writeEnv(webEnvPath, webEnv)
    writeEnv(botEnvPath, botEnv)

    return NextResponse.json({ data: { success: true } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 })
  }
}
