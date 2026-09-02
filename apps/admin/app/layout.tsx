import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import { Vazirmatn } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { MotionProvider } from "@/components/motion-provider"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { NuqsAdapter } from "nuqs/adapters/next/app"

import { QueryProvider } from "@/components/query-provider"
import { AuthProvider } from "@/hooks/use-auth"
import { cn } from "@workspace/ui/lib/utils"

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-sans",
  display: "swap",
})

// Only used for tiny LTR snippets (chat ids, codes); the UI itself is set in
// Vazirmatn.
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// Runs before paint (blocking script at the top of <body>): applies the
// persisted sidebar state to <html> so collapse-dependent styles are correct
// on first paint without making the root layout dynamic.
const sidebarStateScript = `try{if(/(?:^|; )sidebar-open=false(?:;|$)/.test(document.cookie)){document.documentElement.classList.add("sidebar-collapsed")}}catch(e){}`

export const metadata: Metadata = {
  applicationName: "StudentHub",
  title: {
    default: "پنل مدیریت | StudentHub",
    template: "%s | پنل مدیریت StudentHub",
  },
  description: "پنل مدیریت StudentHub - مدیریت کاربران، اعلان‌ها و آرشیوها.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        vazirmatn.variable
      )}
    >
      {/* Blocking, before any body markup parses: applies the persisted
          sidebar state to <html> exactly like next-themes does for themes,
          so collapse-dependent silhouettes are correct on first paint. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: sidebarStateScript }} />
      </head>
      <body>
        <MotionProvider>
          <NuqsAdapter>
            <QueryProvider>
              <AuthProvider>
                <ThemeProvider>
                  <DirectionProvider direction="rtl">
                    {children}
                  </DirectionProvider>
                </ThemeProvider>
              </AuthProvider>
            </QueryProvider>
          </NuqsAdapter>
        </MotionProvider>
      </body>
    </html>
  )
}
