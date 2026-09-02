import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Vazirmatn } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import "./globals.css"
import { TanstackQueryProvider } from "@/providers/tanstack-query"
import { SDKProvider } from "@/providers/sdk-init"
import { SDKLaunchParamsProvider } from "@/providers/launch-params"
import { ThemeProvider } from "@/providers/theme-provider"
import { ToastProvider } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"
import { MotionProvider } from "@/providers/motion-provider"

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  // Maps straight onto Tailwind's sans token (same pattern as apps/admin),
  // so every font-sans utility resolves to Vazirmatn.
  variable: "--font-sans",
  display: "swap",
})

const FALLBACK_SITE_URL = "https://student-hub.ir"

/** Safe wrapper: a malformed NEXT_PUBLIC_SITE_URL would otherwise make
    `new URL` throw at module init and crash EVERY route (root layout). */
function safeSiteUrl(raw: string): URL {
  try {
    return new URL(raw)
  } catch {
    return new URL(FALLBACK_SITE_URL)
  }
}

const siteUrl = safeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL
)

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "StudentHub",
  title: {
    default: "دانشجویار — اپلیکیشن دانشجویی",
    template: "%s | دانشجویار",
  },
  description:
    "اپلیکیشن دانشجویی دانشجویار — برنامه کلاسی هوشمند، ارائه دروس، تداخل‌ها، اعلان تغییرات و چارت فارغ‌التحصیلی. داخل تلگرام و مرورگر.",
  keywords: [
    "StudentHub",
    "استودنت هاب",
    "دانشگاه",
    "برنامه کلاسی",
    "ارائه دروس",
    "چارت تحصیلی",
    "تلگرام مینی اپ",
    "انتخاب واحد",
  ],
  authors: [{ name: "StudentHub", url: siteUrl }],
  creator: "StudentHub",
  publisher: "StudentHub",
  category: "education",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: siteUrl,
    siteName: "دانشجویار",
    title: "دانشجویار — اپلیکیشن دانشجویی",
    description:
      "برنامه کلاسی هوشمند، ارائه دروس و اعلان تغییرات — برای هر دانشگاه و رشته.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "دانشجویار — اپلیکیشن دانشجویی",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "دانشجویار — اپلیکیشن دانشجویی",
    description: "برنامه کلاسی هوشمند، ارائه دروس و اعلان تغییرات.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "512x512", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efeff0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1b" },
  ],
  colorScheme: "light dark",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fa-IR"
      dir="rtl"
      suppressHydrationWarning
      className={cn(vazirmatn.variable, "font-sans antialiased")}
    >
      <body>
        {/* Blocking pre-paint script — restores both dark/light (next-themes
            `theme` key) and the accent palette (`sh-color-theme`) before any
            pixel is painted. This is the ONLY anti-flash mechanism; do not
            rely on next-themes' client-injected script which hydrates after
            paint and causes a white flash on dark users. Keys must stay in
            sync with next-themes (default storageKey="theme") and
            components/app/theme/use-color-theme.ts (STORAGE_KEY). */}
        <Script
          id="theme-restore"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var d=document.documentElement;var m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=null;try{t=localStorage.getItem('theme')}catch(e){}var isDark=t==='dark'||((!t||t==='system')&&m);if(isDark)d.classList.add('dark');else d.classList.remove('dark');var c=null;try{c=localStorage.getItem('sh-color-theme')}catch(e){}if(c&&c!=='studenthub')d.classList.add(c);d.style.colorScheme=isDark?'dark':'light'}catch(e){}})();",
          }}
        />
        {/* Inline copy of telegram-web-app.js (public/telegram.js) - never the
            CDN, per the old app: faster boot inside the webview + works behind
            Iranian filtering. beforeInteractive guarantees it exists before
            SDKProvider's init(). */}
        <Script src="/telegram.js" strategy="beforeInteractive" />
        <SDKProvider>
          <SDKLaunchParamsProvider>
            <ThemeProvider>
              <TanstackQueryProvider>
                <MotionProvider>
                  <ToastProvider position="top-center">
                    {children}
                  </ToastProvider>
                </MotionProvider>
              </TanstackQueryProvider>
            </ThemeProvider>
          </SDKLaunchParamsProvider>
        </SDKProvider>
        <Analytics />
      </body>
    </html>
  )
}
