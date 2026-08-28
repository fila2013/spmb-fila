import type { Metadata } from "next";

import { logoutAction } from "@/app/(auth)/actions";
import { requireAuthPage } from "@/lib/auth/navigation";

export const metadata: Metadata = { title: "Dashboard wali murid" };

export default async function DashboardPage() {
  const user = await requireAuthPage();
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Dashboard wali murid</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Anak Saya</h1><p className="mt-2 text-sm text-slate-600">Masuk sebagai {user.email}</p></div>
        <form action={logoutAction}><button className="rounded-xl border border-emerald-900/20 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">Keluar</button></form>
      </div>
      <section className="mt-8 rounded-3xl border border-dashed border-emerald-900/25 bg-emerald-50/50 px-6 py-12 text-center">
        <h2 className="text-xl font-bold text-emerald-950">Belum ada calon murid</h2>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">Fitur penambahan dan pengelolaan data anak akan tersedia pada Phase 4. Session dan batas akses akun ini sudah aktif.</p>
      </section>
    </div>
  );
}

