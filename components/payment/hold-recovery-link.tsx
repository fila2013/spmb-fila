import Link from "next/link";

export function HoldRecoveryLink({ childId, manual = false }: { childId: string; manual?: boolean }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
    <p>Hold sebelumnya sudah berakhir atau tidak aktif. Kuota baru hanya dapat ditahan jika kursi masih tersedia.</p>
    {manual ? <p className="mt-1">Jika sudah transfer, jangan transfer ulang. Setelah memperoleh hold baru, unggah kembali bukti yang sama. Jika kuota penuh, hubungi panitia.</p> : null}
    <Link href={`/anak/${childId}/kategori?hold=expired`} className="mt-3 inline-flex rounded-xl bg-emerald-900 px-4 py-2.5 font-bold text-white hover:bg-emerald-800">Periksa kuota & minta hold baru</Link>
  </div>;
}
