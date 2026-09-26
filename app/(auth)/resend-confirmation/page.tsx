import type { Metadata } from "next";

import { ResendConfirmationForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Kirim ulang verifikasi email" };

export default function ResendConfirmationPage() {
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">
        Verifikasi akun
      </p>
      <h1 className="mt-2 text-3xl font-bold text-emerald-950">
        Kirim ulang email verifikasi
      </h1>
      <p className="mb-7 mt-3 leading-7 text-slate-600">
        Gunakan alamat email yang sama ketika membuat akun. Tautan sebelumnya
        akan digantikan oleh tautan konfirmasi terbaru.
      </p>
      <ResendConfirmationForm />
    </>
  );
}
