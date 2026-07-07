import type { Metadata } from "next"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "QuizFlow",
  description: "Practice and master your knowledge with quizzes",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://telegram.org/js/telegram-webapp.js" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.toggle('dark', localStorage.getItem('theme') === 'dark')`,
          }}
        />
      </head>
      <body className="font-sans bg-canvas text-ink antialiased transition-colors duration-200" suppressHydrationWarning>
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
          signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/"}
          signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/"}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}