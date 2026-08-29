import Link from "next/link";
import type { ReactNode } from "react";

export function EnrollmentShell({
  childId,
  childName,
  active,
  children,
}: {
  childId: string;
  childName: string;
  active: "data-pribadi" | "observasi";
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-emerald-800 hover:underline">← Kembali ke Anak Saya</Link>
      <section className="mt-6 overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-sm">
        <div className="bg-emerald-950 px-6 py-7 text-white sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-300">Enrollment · {childName}</p>
          <h1 className="mt-2 text-3xl font-bold">Lengkapi formulir pendaftaran</h1>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <Link
              href={`/anak/${childId}/enrollment/data-pribadi`}
              aria-current={active === "data-pribadi" ? "step" : undefined}
              className={`rounded-full px-4 py-2 font-bold ${active === "data-pribadi" ? "bg-amber-300 text-emerald-950" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              1. Data Pribadi
            </Link>
            <Link
              href={`/anak/${childId}/enrollment/observasi`}
              aria-current={active === "observasi" ? "step" : undefined}
              className={`rounded-full px-4 py-2 font-bold ${active === "observasi" ? "bg-amber-300 text-emerald-950" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              2. Observasi
            </Link>
          </div>
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </section>
    </div>
  );
}
