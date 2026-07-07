import type { Metadata } from "next"
import "./globals.css"
import AuthProvider from "@/components/auth/AuthProvider"

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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}