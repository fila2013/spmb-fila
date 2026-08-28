import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Lupa password" };

export default function ForgotPasswordPage() {
  return <><p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Pemulihan akun</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Reset password</h1><p className="mb-7 mt-3 leading-7 text-slate-600">Kami akan mengirim tautan reset jika email terdaftar.</p><ForgotPasswordForm /></>;
}

