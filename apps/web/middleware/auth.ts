import { NextRequest, NextResponse } from "next/server"
import { verifyToken, AuthPayload } from "../lib/auth"

export function getAuthUser(request: NextRequest): AuthPayload | null {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return verifyToken(header.slice(7))
}

export function withAuth(request: NextRequest): { user: AuthPayload } | NextResponse {
  const user = getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 })
  }
  return { user }
}
