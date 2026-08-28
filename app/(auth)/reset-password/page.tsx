import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Password baru" };

export default function ResetPasswordPage() {
  return <><p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Pemulihan akun</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Buat password baru</h1><p className="mb-7 mt-3 leading-7 text-slate-600">Gunakan minimal 8 karakter yang tidak mudah ditebak.</p><ResetPasswordForm /></>;
}

