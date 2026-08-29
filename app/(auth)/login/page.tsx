import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const authStatus =
    params.error_code === "otp_expired" ? "otp_expired" : params.auth;
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Portal wali murid</p>
      <h1 className="mt-2 text-3xl font-bold text-emerald-950">Masuk ke akun</h1>
      <p className="mb-7 mt-3 leading-7 text-slate-600">Kelola pendaftaran seluruh anak dalam satu akun.</p>
      {params.reset === "success" ? <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Password berhasil diperbarui. Silakan masuk kembali.</p> : null}
      {authStatus === "invalid" ? <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Tautan autentikasi tidak valid atau telah kedaluwarsa.</p> : null}
      {authStatus === "otp_expired" ? <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">Tautan sudah pernah digunakan atau kedaluwarsa. Jika Anda dapat masuk, akun sudah terkonfirmasi; jika belum, minta tautan baru.</p> : null}
      {params.auth === "forbidden" ? <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Akun tidak dapat mengakses halaman tersebut.</p> : null}
      <LoginForm />
    </>
  );
}
