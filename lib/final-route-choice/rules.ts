import {
  PilihanJalurFinal,
  StatusKeseluruhan,
  StatusPengumuman,
} from "@/generated/prisma/enums";

export function releasedStatusAfterAcceptedDecision(input: {
  statusAkhir: StatusPengumuman;
  finalChoiceEnabled: boolean;
  fallbackJalurId: string | null;
}) {
  if (input.statusAkhir === StatusPengumuman.TIDAK_DITERIMA) {
    return StatusKeseluruhan.TIDAK_DITERIMA;
  }
  return input.finalChoiceEnabled && input.fallbackJalurId
    ? StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR
    : StatusKeseluruhan.DITERIMA;
}

export function finalRouteChoiceLabel(choice: PilihanJalurFinal | null) {
  if (choice === PilihanJalurFinal.TETAP_JALUR_ASAL) {
    return "Tetap di jalur asal";
  }
  if (choice === PilihanJalurFinal.JALUR_FALLBACK) {
    return "Pindah ke jalur reguler/fallback";
  }
  return "Belum memilih";
}
