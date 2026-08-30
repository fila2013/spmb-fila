import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/(auth)/actions";

const navigation = [
  { href: "/admin/dashboard", label: "Ringkasan" },
  { href: "/admin/jalur", label: "Jalur & kuota" },
  { href: "/admin/kategori", label: "Kategori & kuota" },
  { href: "/admin/biaya-pendaftaran", label: "Biaya pendaftaran" },
  { href: "/admin/form-builder", label: "Form builder" },
  { href: "/admin/peserta", label: "Peserta" },
  { href: "/admin/konten/assessment", label: "Konten assessment" },
  { href: "/admin/konten/announcement", label: "Konten announcement" },
  { href: "/admin/konten/admission-fee", label: "Konten daftar ulang" },
  { href: "/admin/konten/join-wa", label: "Konten Join WhatsApp" },
  { href: "/admin/laporan", label: "Laporan" },
];

export function AdminShell({
  activePath,
  title,
  description,
  email,
  children,
}: {
  activePath: string;
  title: string;
  description: string;
  email: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-12">
      <aside className="h-fit rounded-2xl border border-emerald-950/10 bg-white p-4 lg:sticky lg:top-6">
        <p className="px-3 text-xs font-bold uppercase tracking-[0.17em] text-amber-700">
          Admin SPMB
        </p>
        <nav aria-label="Navigasi admin" className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activePath === item.href ? "page" : undefined}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                activePath === item.href
                  ? "bg-emerald-900 text-white"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 border-t border-emerald-950/10 px-3 pt-4">
          <p className="truncate text-xs text-slate-500" title={email}>{email}</p>
          <form action={logoutAction} className="mt-2">
            <button className="text-sm font-semibold text-red-700 hover:underline">Keluar</button>
          </form>
        </div>
      </aside>

      <main>
        <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Administrasi SPMB</p>
        <h1 className="mt-2 text-3xl font-bold text-emerald-950">{title}</h1>
        <p className="mt-2 max-w-3xl leading-7 text-slate-600">{description}</p>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
