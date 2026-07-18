import type { Metadata } from "next"
import AuthProvider from "@/components/auth/AuthProvider"
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <script src="https://telegram.org/js/telegram-webapp.js" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.toggle('dark', localStorage.getItem('theme') === 'dark')`,
          }}
        />
      </head>
      <body className="font-sans bg-canvas text-ink antialiased transition-colors duration-200" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
