import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Quiz App",
  description: "Practice and master your knowledge with quizzes",
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
        {children}
      </body>
    </html>
  )
}
