import type { Metadata, Viewport } from "next"
import { Vazirmatn } from "next/font/google"

import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import { MotionProvider } from "@/components/motion-provider"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { ToastProvider } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "ابزار ساخت چارت | دانشجویار",
  description:
    "چارت درسی رشتهٔ خود را بسازید و به رجیستری دانشجویار اضافه کنید",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
}

// Runs before paint (blocking script at the top of <body>): applies the
// persisted sidebar state to <html> so collapse-dependent styles are correct
// on first paint without making the root layout dynamic.
const sidebarStateScript =
  'try{if(/(?:^|; )sidebar-open=false(?:;|$)/.test(document.cookie)){document.documentElement.classList.add("sidebar-collapsed")}}catch(e){}'

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
      className={cn("antialiased", vazirmatn.variable)}
    >
      {/* Blocking, before any body markup parses: applies the persisted
          sidebar state to <html> exactly like next-themes does for themes,
          so collapse-dependent silhouettes are correct on first paint. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: sidebarStateScript }} />
      </head>
      <body>
        <MotionProvider>
          <ThemeProvider defaultTheme="dark">
            <DirectionProvider direction="rtl">{children}</DirectionProvider>
          </ThemeProvider>
          <ToastProvider position="top-center" />
        </MotionProvider>
      </body>
    </html>
  )
}
