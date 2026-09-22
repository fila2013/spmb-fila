"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function remainingParts(expiresAt: string) {
  const milliseconds = Math.max(
    new Date(expiresAt).getTime() - Date.now(),
    0,
  );
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { expired: milliseconds === 0, hours, minutes, seconds };
}

export function QuotaHoldCountdown({
  childId,
  expiresAt,
}: {
  childId: string;
  expiresAt: string;
}) {
  const [remaining, setRemaining] = useState(() => remainingParts(expiresAt));

  useEffect(() => {
    const interval = window.setInterval(
      () => setRemaining(remainingParts(expiresAt)),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  if (remaining.expired) {
    return (
      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950">
        <p className="font-bold">Waktu hold kuota telah berakhir</p>
        <p>Kuota sudah dilepas kembali ke pool publik.</p>
        <Link
          href={`/anak/${childId}/kategori?hold=expired`}
          className="mt-2 inline-flex font-bold text-red-800 underline"
        >
          Kembali ke pilihan jalur dan kategori
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
      <p className="font-bold">Kuota ditahan sementara untuk peserta ini</p>
      <p>
        Selesaikan pembayaran dalam{" "}
        <strong className="tabular-nums">
          {String(remaining.hours).padStart(2, "0")}:
          {String(remaining.minutes).padStart(2, "0")}:
          {String(remaining.seconds).padStart(2, "0")}
        </strong>
        . Setelah waktu habis, kuota otomatis tersedia kembali.
      </p>
    </div>
  );
}
