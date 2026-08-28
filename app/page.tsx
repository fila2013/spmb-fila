const alurPendaftaran = [
  "Buat akun",
  "Tambahkan anak",
  "Pilih jalur dan kategori",
  "Bayar pendaftaran",
  "Isi enrollment",
  "Ikuti assessment",
  "Lihat pengumuman",
  "Selesaikan daftar ulang",
];

export default function Home() {
  return (
    <div className="bg-[radial-gradient(circle_at_top_right,_rgba(217,158,54,0.14),_transparent_34%),linear-gradient(180deg,#f4fbf7_0%,#ffffff_55%)]">
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
            Penerimaan murid baru
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-emerald-950 sm:text-5xl">
            Proses pendaftaran sekolah yang jelas dalam satu portal.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Wali murid dapat mengelola pendaftaran setiap anak, mengikuti tahapan,
            dan memantau status terbaru secara mandiri.
          </p>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-amber-700/20 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
            Jadwal pembukaan portal akan diumumkan oleh panitia SPMB.
          </div>
        </div>

        <aside className="rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-[0_24px_70px_rgba(6,78,59,0.10)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Satu akun, banyak anak
          </p>
          <h2 className="mt-3 text-2xl font-bold text-emerald-950">
            Setiap anak memiliki progres pendaftaran yang terpisah.
          </h2>
          <p className="mt-4 leading-7 text-slate-600">
            Data, pembayaran, enrollment, assessment, dan hasil penerimaan dapat
            dipantau per calon murid tanpa membuat akun wali murid baru.
          </p>
        </aside>
      </section>

      <section
        className="border-y border-emerald-950/10 bg-white/80"
        aria-labelledby="alur-title"
      >
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
              Alur utama
            </p>
            <h2 id="alur-title" className="mt-2 text-3xl font-bold text-emerald-950">
              Dari registrasi sampai daftar ulang
            </h2>
          </div>

          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {alurPendaftaran.map((tahap, index) => (
              <li
                key={tahap}
                className="flex min-h-24 items-start gap-3 rounded-2xl border border-emerald-950/10 bg-white p-4"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-900 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm font-semibold leading-6 text-slate-800">
                  {tahap}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
