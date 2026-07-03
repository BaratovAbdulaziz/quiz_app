import { NextRequest, NextResponse } from "next/server"
import { execSync } from "child_process"
import { writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

const ADMIN_PASSWORD = "2312"

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid password" } }, { status: 401 })
    }

    const killFlagPath = join(process.cwd(), ".killed")
    writeFileSync(killFlagPath, new Date().toISOString(), "utf-8")

    try {
      execSync("pm2 kill", { timeout: 5000, stdio: "ignore" })
    } catch {}

    return NextResponse.json({ data: { success: true, message: "Site killed" } })
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Kill failed" } }, { status: 500 })
  }
}

export async function GET() {
  const killed = existsSync(join(process.cwd(), ".killed"))
  return NextResponse.json({ data: { killed } })
}
