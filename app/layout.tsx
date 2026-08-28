import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "SPMB FILA",
  title: {
    default: "SPMB FILA — SDIT Fitrah Insani Langkapura",
    template: "%s | SPMB FILA",
  },
  description:
    "Sistem Penerimaan Murid Baru SDIT Fitrah Insani Langkapura.",
  icons: {
    icon: "/brand-mark.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full">
        <a
          href="#konten-utama"
          className="sr-only z-50 rounded-md bg-emerald-950 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Lewati ke konten utama
        </a>

        <div className="flex min-h-screen flex-col">
          <header className="border-b border-emerald-950/10 bg-white/95">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
              >
                <span
                  aria-hidden="true"
                  className="grid size-11 place-items-center rounded-xl bg-emerald-900 text-sm font-bold tracking-wide text-white shadow-sm"
                >
                  FI
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                    SPMB FILA
                  </span>
                  <span className="block text-sm font-semibold text-emerald-950 sm:text-base">
                    SDIT Fitrah Insani Langkapura
                  </span>
                </span>
              </Link>

              <nav aria-label="Akun" className="flex items-center gap-2">
                <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">Masuk</Link>
                <Link href="/register" className="rounded-lg bg-emerald-900 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Daftar</Link>
              </nav>
            </div>
          </header>

          <main id="konten-utama" className="flex-1">
            {children}
          </main>

          <footer className="border-t border-emerald-950/10 bg-white">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-6 text-sm text-slate-600 sm:px-8">
              <p className="font-semibold text-emerald-950">
                SDIT Fitrah Insani Langkapura
              </p>
              <p>Informasi resmi penerimaan murid baru tersedia melalui portal ini.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
