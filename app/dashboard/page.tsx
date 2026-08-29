import type { Metadata } from "next";
import Link from "next/link";

import { logoutAction } from "@/app/(auth)/actions";
import { StatusKeseluruhan } from "@/generated/prisma/enums";
import { requireWaliPage } from "@/lib/auth/navigation";
import { statusPresentation } from "@/lib/calon-murid/presentation";
import { listOwnedCalonMurid } from "@/lib/calon-murid/service";

export const metadata: Metadata = { title: "Dashboard wali murid" };

function nextLink(child: {
  id: string;
  jalurId: string | null;
  statusKeseluruhan: StatusKeseluruhan;
}) {
  if (child.statusKeseluruhan === StatusKeseluruhan.PILIH_JALUR) {
    return child.jalurId ? `/anak/${child.id}/kategori` : "/anak/tambah";
  }
  if (
    child.statusKeseluruhan ===
    StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR
  ) {
    return `/anak/${child.id}/pembayaran-pendaftaran`;
  }
  if (child.statusKeseluruhan === StatusKeseluruhan.ENROLLMENT) {
    return `/anak/${child.id}/enrollment/data-pribadi`;
  }
  if (child.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_ASESMEN) {
    return `/anak/${child.id}/assessment`;
  }
  if (
    child.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_PENGUMUMAN ||
    child.statusKeseluruhan === StatusKeseluruhan.DITERIMA ||
    child.statusKeseluruhan === StatusKeseluruhan.TIDAK_DITERIMA ||
    child.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK
  ) {
    return `/anak/${child.id}/pengumuman`;
  }
  return null;
}

export default async function DashboardPage() {
  const user = await requireWaliPage();
  const children = await listOwnedCalonMurid(user.userId);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.17em] text-amber-700">Dashboard wali murid</p>
          <h1 className="mt-2 text-3xl font-bold text-emerald-950">Anak Saya</h1>
          <p className="mt-2 text-sm text-slate-600">Masuk sebagai {user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/anak/tambah" className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">+ Tambah anak</Link>
          <form action={logoutAction}><button className="rounded-xl border border-emerald-900/20 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">Keluar</button></form>
        </div>
      </div>

      {children.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-emerald-900/25 bg-emerald-50/50 px-6 py-12 text-center">
          <h2 className="text-xl font-bold text-emerald-950">Belum ada calon murid</h2>
          <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">Tambahkan anak dan pilih jalur pendaftaran yang masih tersedia. Setiap anak akan memiliki proses dan statusnya sendiri.</p>
          <Link href="/anak/tambah" className="mt-6 inline-flex rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">Tambah anak pertama</Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-5 sm:grid-cols-2">
          {children.map((child) => {
            const status = statusPresentation[child.statusKeseluruhan];
            const href = nextLink(child);
            return (
              <article key={child.id} className="rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Calon murid</p><h2 className="mt-1 text-xl font-bold text-emerald-950">{child.namaAnak}</h2></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Jalur</dt><dd className="font-semibold text-slate-800">{child.jalur?.nama ?? "Belum dipilih"}</dd></div>
                  <div><dt className="text-slate-500">Kategori</dt><dd className="font-semibold text-slate-800">{child.kategori?.nama ?? "Belum dipilih"}</dd></div>
                </dl>
                {href ? (
                  <Link href={href} className="mt-6 inline-flex w-full justify-center rounded-xl bg-emerald-900 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800">Lihat tahap saat ini</Link>
                ) : (
                  <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Tahap berikutnya akan muncul sesuai progres pendaftaran.</p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
