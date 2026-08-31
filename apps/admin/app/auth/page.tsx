import type { Metadata } from "next"

import { LoginForm } from "@/app/auth/login-form"

export const metadata: Metadata = { title: "ورود مدیران" }

export default function LoginPage() {
  return <LoginForm />
}
