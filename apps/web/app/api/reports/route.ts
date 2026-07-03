import { NextRequest, NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { questionReports } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function GET(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const result = await db.select()
    .from(questionReports)
    .where(eq(questionReports.ownerId, auth.user.userId))
    .orderBy(desc(questionReports.createdAt))

  return NextResponse.json({ data: result })
}
