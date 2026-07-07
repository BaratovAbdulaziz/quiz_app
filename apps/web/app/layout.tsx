import type { Metadata } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import fs from "fs"
import path from "path"

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
  const cssContent = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf-8")
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssContent }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://telegram.org/js/telegram-webapp.js" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.toggle('dark', localStorage.getItem('theme') === 'dark')`,
          }}
        />
      </head>
      <body className="font-sans bg-canvas text-ink antialiased transition-colors duration-200" suppressHydrationWarning>
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider
            publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
            signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/"}
            signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/"}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  )
}