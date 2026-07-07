import { Webhook } from "svix"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { upsertUserByClerk } from "@/lib/auth"

type ClerkWebhookEvent = {
  data: {
    id: string
    email_addresses?: { email_address: string }[]
    first_name?: string
    last_name?: string
    image_url?: string
    username?: string
  }
  object: "event"
  type: "user.created" | "user.updated" | "user.deleted"
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: "CLERK_WEBHOOK_SECRET not configured" }, { status: 500 })
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get("svix-id")
  const svixTimestamp = headerPayload.get("svix-timestamp")
  const svixSignature = headerPayload.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const body = await request.text()
  const wh = new Webhook(webhookSecret)

  let event: ClerkWebhookEvent
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = event.data
    const email = email_addresses?.[0]?.email_address
    const displayName = [first_name, last_name].filter(Boolean).join(" ") || email || id

    try {
      await upsertUserByClerk({
        clerkId: id,
        email: email || null,
        displayName,
        photoUrl: image_url || null,
      })
    } catch (error) {
      console.error("Failed to sync Clerk user to PG:", error)
      return NextResponse.json({ error: "Failed to sync user" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
