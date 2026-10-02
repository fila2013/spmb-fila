import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { ParticipantQuickEditTable } from "@/components/admin/participant-quick-edit";
import { StatusAssessment, StatusKeseluruhan, UserRole } from "@/generated/prisma/enums";
import { requireRolePage } from "@/lib/auth/navigation";
import { statusPresentation } from "@/lib/calon-murid/presentation";
import { listJalur, listKategori } from "@/lib/master-data/service";
import type { QuickEditParticipant } from "@/lib/stages/quick-edit";
import { dateOnly } from "@/lib/stages/rules";
import { participantListFilterSchema } from "@/lib/stages/schemas";
import { listParticipants } from "@/lib/stages/service";

export const metadata: Metadata = { title: "Peserta SPMB" };

type SearchParams = Record<string, string | string[] | undefined>;

function searchParamsRecord(searchParams: SearchParams) {
  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900"
      >
        <option value="">Semua</option>
        {children}
      </select>
    </label>
  );
}

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireRolePage(UserRole.ADMIN);
  const rawFilters = searchParamsRecord(await searchParams);
  const parsed = participantListFilterSchema.safeParse(rawFilters);
  const filters = parsed.success ? parsed.data : {};
  const [jalur, kategori, participants] = await Promise.all([
    listJalur(),
    listKategori(),
    listParticipants(filters),
  ]);
  const quickEditParticipants: QuickEditParticipant[] = participants.map((item) => ({
    id: item.id,
    namaAnak: item.namaAnak,
    email: item.user.email,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    jalurKategori: `${item.jalur?.nama ?? item.menungguFallbackJalur?.nama ?? item.jalurAsal?.nama ?? "—"} / ${item.kategori?.nama ?? "—"}`,
    statusKeseluruhan: item.statusKeseluruhan,
    assessmentStatus: item.hasilAssessment?.status ?? StatusAssessment.BELUM,
    assessmentNote: item.hasilAssessment?.catatan ?? "",
    announcementStatus: item.pengumuman?.statusAkhir ?? null,
    releaseDate: dateOnly(item.pengumuman?.tanggalRilis ?? null) ?? "",
    announcementLocked: Boolean(item.pilihanJalurFinal) ||
      item.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR ||
      item.statusKeseluruhan === StatusKeseluruhan.MENUNGGU_KUOTA_FALLBACK,
    requiresDeleteConfirmation: Boolean(item.jalur?.hapusDataJikaGagal && !item.jalur.fallbackJalurId),
    finalRouteChoiceEnabled: Boolean(item.jalur?.pilihanJalurFinalAktif),
  }));

  return (
    <AdminShell
      activePath="/admin/peserta"
      title="Peserta"
      description="Kelola assessment, pengumuman, pembayaran DU, link grup, dan konfirmasi WhatsApp setiap calon murid."
      email={admin.email}
    >
      {rawFilters.deleted === "1" ? (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          Data pribadi calon murid telah dihapus. Akun wali, anak lain, jejak pembayaran, dan snapshot audit tetap tersimpan.
        </p>
      ) : null}
      {!parsed.success ? (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          Sebagian filter tidak valid dan telah diabaikan.
        </p>
      ) : null}

      <form className="rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2 xl:col-span-3">
            <span>Cari nama peserta</span>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Nama calon murid"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900"
            />
          </label>
          <FilterSelect name="jalurId" label="Jalur" defaultValue={filters.jalurId}>
            {jalur.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            name="kategoriId"
            label="Kategori"
            defaultValue={filters.kategoriId}
          >
            {kategori.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            name="statusKeseluruhan"
            label="Status tahapan"
            defaultValue={filters.statusKeseluruhan}
          >
            {Object.values(StatusKeseluruhan).map((status) => (
              <option key={status} value={status}>
                {statusPresentation[status].label}
              </option>
            ))}
          </FilterSelect>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
            Terapkan filter
          </button>
          <Link
            href="/admin/peserta"
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </Link>
        </div>
      </form>

      <section className="mt-6 rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-6">
        <ParticipantQuickEditTable
          key={`${JSON.stringify(filters)}:${quickEditParticipants.map((item) => `${item.id}:${item.updatedAt}`).join("|")}`}
          initialParticipants={quickEditParticipants}
          filteredStatus={filters.statusKeseluruhan ?? null}
        />
      </section>
    </AdminShell>
  );
}
