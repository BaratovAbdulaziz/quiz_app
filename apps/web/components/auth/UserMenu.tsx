"use client"

import { useClerk, useUser } from "@clerk/nextjs"

export default function UserMenu() {
  const { user } = useUser()
  const { signOut } = useClerk()

  if (!user) return null

  return (
    <button
      onClick={() => signOut()}
      className="flex items-center gap-2 text-body-sm text-steel py-2 cursor-pointer hover:text-ink transition-colors duration-150"
    >
      <div className="w-5 h-5 rounded-full bg-surface border border-hairline flex items-center justify-center text-micro overflow-hidden">
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          user.firstName?.[0] || "?"
        )}
      </div>
      Sign out ({user.emailAddresses?.[0]?.emailAddress || user.fullName})
    </button>
  )
}
