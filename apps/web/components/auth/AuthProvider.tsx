"use client"

import { ClerkProvider, useAuth } from "@clerk/nextjs"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ConvexReactClient } from "convex/react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!clerkPublishableKey) {
    return <>{children}</>
  }

  const inner = convex ? (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  ) : (
    children
  )

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/"}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/"}
    >
      {inner}
    </ClerkProvider>
  )
}
