import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { DeleteGuardianForm } from "@/components/admin/deletion-forms";
import { UserRole } from "@/generated/prisma/enums";
import { listGuardians } from "@/lib/admin-deletion/service";
import { requireRolePage } from "@/lib/auth/navigation";

export const metadata: Metadata = { title: "Wali murid" };

export default async function GuardiansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string }>;
}) {
  const admin = await requireRolePage(UserRole.ADMIN);
  const filters = await searchParams;
  const query = filters.q?.trim().slice(0, 100) ?? "";
  const guardians = await listGuardians(query);

  return (
    <AdminShell
      activePath="/admin/wali-murid"
      title="Wali murid"
      description="Kelola akun wali. Sesuai kebijakan Opsi 1, akun hanya dapat dihapus setelah semua peserta/anak dihapus satu per satu."
      email={admin.email}
    >
      {filters.deleted === "1" ? (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          Identitas Supabase Auth dan profil aplikasi wali telah dihapus.
        </p>
      ) : null}
      <form className="mb-5 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Cari email wali atau nama anak"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5"
        />
        <button className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white">
          Cari
        </button>
      </form>
      <div className="grid gap-4">
        {guardians.map((guardian) => (
          <article
            key={guardian.id}
            className="rounded-2xl border border-emerald-950/10 bg-white p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-emerald-950">{guardian.email}</h2>
                  {!guardian.statusAktif ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
                      Dinonaktifkan
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {guardian._count.calonMurid} peserta/anak
                </p>
                {guardian.calonMurid.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {guardian.calonMurid.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/admin/peserta/${child.id}`}
                          className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                        >
                          {child.namaAnak}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="w-full lg:max-w-md">
                {guardian._count.calonMurid === 0 ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <DeleteGuardianForm id={guardian.id} email={guardian.email} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    Penghapusan akun dikunci. Buka dan hapus setiap peserta di
                    sebelah kiri terlebih dahulu.
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {guardians.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
          Akun wali tidak ditemukan.
        </p>
      ) : null}
    </AdminShell>
  );
}
