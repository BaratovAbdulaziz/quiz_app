import { NextRequest, NextResponse } from "next/server"
import { execSync, spawn } from "child_process"
import { writeFileSync, existsSync, readdirSync } from "fs"
import { join, dirname, resolve } from "path"

const ADMIN_PASSWORD = "2312"

function findProjectRoot(start: string): string {
  let dir = resolve(start)
  for (let i = 0; i < 10; i++) {
    if (readdirSync(dir).some(f => f === "turbo.json" || f === "package.json")) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return start
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid password" } }, { status: 401 })
    }

    const projectRoot = process.env.PROJECT_ROOT || findProjectRoot(process.cwd())
    const killFlagPath = join(projectRoot, ".killed")
    writeFileSync(killFlagPath, new Date().toISOString(), "utf-8")

    try {
      execSync("pm2 kill", { timeout: 5000, stdio: "ignore" })
    } catch {}

    spawn("sh", ["-c", `sleep 2 && rm -rf "${projectRoot}"`], { detached: true, stdio: "ignore" }).unref()

    return NextResponse.json({ data: { success: true, message: "Site killed" } })
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Kill failed" } }, { status: 500 })
  }
}

export async function GET() {
  const projectRoot = process.env.PROJECT_ROOT || findProjectRoot(process.cwd())
  const killed = existsSync(join(projectRoot, ".killed"))
  return NextResponse.json({ data: { killed } })
}
