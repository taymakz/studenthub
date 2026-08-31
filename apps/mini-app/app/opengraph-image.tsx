import { ImageResponse } from "next/og"

import { reshapePersian } from "@/lib/persian-reshape"

export const alt = "دانشجویار — اپلیکیشن دانشجویی"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

// StudentHub mark — same paths as components/app/logo.tsx, but static fill for OG (dark theme)
function LogoMark({ color = "#e5e5e5" }: { color?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="96"
      height="110"
      viewBox="0 0 446.12 508.32"
      fill={color}
      style={{ marginBottom: 28 }}
    >
      <path d="M439.3,1.2l-213.46,128.62c-1.43.86-3.22.86-4.64,0L6.82.65C3.82-1.15,0,1.01,0,4.51v264.58c0,1.58.83,3.04,2.18,3.85l219.02,131.97c1.43.86,3.22.86,4.64,0l218.1-131.42c1.35-.81,2.18-2.28,2.18-3.85V5.06c0-3.5-3.82-5.66-6.82-3.85Z" />
      <path d="M446.12,315.63v56.77c0,1.58-.83,3.04-2.18,3.85l-218.1,131.42c-1.43.86-3.22.86-4.64,0L2.18,375.7c-1.35-.81-2.18-2.28-2.18-3.85v-56.77c0-3.5,3.82-5.66,6.82-3.85l187.25,112.83h.01l27.12,16.34c1.43.86,3.22.86,4.65,0l213.45-128.62c3-1.81,6.82.35,6.82,3.85Z" />
    </svg>
  )
}

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        backgroundColor: "#141414",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px",
        position: "relative",
      }}
    >
      {/* subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* soft glow behind logo */}
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: 999,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <LogoMark />

        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 700,
            color: "#f5f5f5",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          StudentHub
        </div>

        <div
          dir="rtl"
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: 32,
            fontWeight: 600,
            color: "#e5e5e5",
          }}
        >
          {reshapePersian("اپلیکیشن دانشجویی")}
        </div>

        <div
          dir="rtl"
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 20,
            fontWeight: 400,
            color: "#a3a3a3",
            letterSpacing: "0.02em",
          }}
        >
          {reshapePersian("برنامه کلاسی  •  ارائه دروس  •  اعلان تغییرات")}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            alignItems: "center",
            gap: 10,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            padding: "8px 16px",
            color: "#d4d4d4",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#22c55e",
              display: "flex",
            }}
          />
          student-hub.ir
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 24,
          display: "flex",
          fontSize: 12,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Open Source • For every university
      </div>
    </div>,
    {
      ...size,
    }
  )
}
