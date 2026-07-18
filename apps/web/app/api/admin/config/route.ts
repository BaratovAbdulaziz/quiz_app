import { NextRequest, NextResponse } from "next/server"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname, resolve } from "path"
import { execSync } from "child_process"

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

function setConvexEnv(key: string, value: string): void {
  try {
    const projectRoot = findProjectRoot(process.cwd())
    const webDir = join(projectRoot, "apps", "web")
    execSync(`npx convex env set ${key} "${value}"`, {
      cwd: webDir,
      stdio: "pipe",
      timeout: 30000,
    })
  } catch (error) {
    console.error(`Failed to set Convex env var ${key}:`, error)
  }
}

export async function GET(request: NextRequest) {
  const projectRoot = findProjectRoot(process.cwd())
  const webEnvPath = join(projectRoot, "apps", "web", ".env")
  const webLocalEnvPath = join(projectRoot, "apps", "web", ".env.local")

  const webEnvVars = existsSync(webEnvPath) ? parseEnv(readFileSync(webEnvPath, "utf-8")) : {}
  const webLocalVars = existsSync(webLocalEnvPath) ? parseEnv(readFileSync(webLocalEnvPath, "utf-8")) : {}
  const webVars = { ...webEnvVars, ...webLocalVars }

  const { searchParams } = new URL(request.url)
  const exportAll = searchParams.get("export") === "true"

  if (exportAll) {
    const { password } = Object.fromEntries(searchParams)
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid password" } }, { status: 401 })
    }
    return NextResponse.json({ data: webVars })
  }

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

    for (const [key, val] of Object.entries(body)) {
      if (val === undefined || val === null) continue
      webEnv[key] = String(val)
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

    if (body.OPENROUTER_API_KEYS !== undefined) {
      setConvexEnv("OPENROUTER_API_KEYS", body.OPENROUTER_API_KEYS)
    }

    return NextResponse.json({ data: { success: true } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 })
  }
}
