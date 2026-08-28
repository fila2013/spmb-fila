import type { Metadata } from "next";

import { logoutAction } from "@/app/(auth)/actions";
import { UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";

export const metadata: Metadata = { title: "Dashboard admin" };

export default async function AdminDashboardPage() {
  const admin = await requireRolePage(UserRole.ADMIN);
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      <div className="flex flex-wrap justify-between gap-5"><div><p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Area administrator</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Dashboard SPMB</h1><p className="mt-2 text-sm text-slate-600">Session admin terverifikasi: {admin.email}</p></div><form action={logoutAction}><button className="rounded-xl border border-emerald-900/20 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">Keluar</button></form></div>
      <div className="mt-8 rounded-3xl border border-emerald-950/10 bg-emerald-50 p-7"><h2 className="text-xl font-bold text-emerald-950">Fondasi admin siap</h2><p className="mt-2 leading-7 text-slate-600">Modul konfigurasi dan operasional admin akan dilanjutkan pada Phase 3.</p></div>
    </div>
  );
}

