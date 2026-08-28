import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Buat akun" };

export default function RegisterPage() {
  return <><p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Akun wali murid</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Buat akun baru</h1><p className="mb-7 mt-3 leading-7 text-slate-600">Gunakan email aktif untuk menerima konfirmasi dan pemulihan akun.</p><RegisterForm /></>;
}

