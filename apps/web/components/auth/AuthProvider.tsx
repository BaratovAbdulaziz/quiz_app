"use client"

import { ClerkProvider, useAuth } from "@clerk/nextjs"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ConvexReactClient } from "convex/react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

const DUMMY_KEY = "pk_test_ZHVtbXkxMjM0NTY3ODkw"

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const key = clerkPublishableKey || DUMMY_KEY

  const inner = convex ? (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  ) : (
    children
  )

  return (
    <ClerkProvider
      publishableKey={key}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/"}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/"}
    >
      {inner}
    </ClerkProvider>
  )
}
