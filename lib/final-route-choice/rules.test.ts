import { describe, expect, it } from "vitest";

import {
  PilihanJalurFinal,
  StatusKeseluruhan,
  StatusPengumuman,
} from "@/generated/prisma/enums";
import {
  finalRouteChoiceLabel,
  releasedStatusAfterAcceptedDecision,
} from "@/lib/final-route-choice/rules";

describe("pilihan jalur final TCP", () => {
  it("meminta pilihan untuk hasil diterima berdasarkan target final, bukan fallback", () => {
    expect(
      releasedStatusAfterAcceptedDecision({
        statusAkhir: StatusPengumuman.DITERIMA,
        finalChoiceEnabled: true,
        finalChoiceTargetId: "reguler",
      }),
    ).toBe(StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR);
    expect(
      releasedStatusAfterAcceptedDecision({
        statusAkhir: StatusPengumuman.DITERIMA,
        finalChoiceEnabled: false,
        finalChoiceTargetId: "reguler",
      }),
    ).toBe(StatusKeseluruhan.DITERIMA);
  });

  it("tidak mengubah alur peserta yang tidak diterima", () => {
    expect(
      releasedStatusAfterAcceptedDecision({
        statusAkhir: StatusPengumuman.TIDAK_DITERIMA,
        finalChoiceEnabled: true,
        finalChoiceTargetId: "reguler",
      }),
    ).toBe(StatusKeseluruhan.TIDAK_DITERIMA);
  });

  it("memberikan label pilihan yang ramah pengguna", () => {
    expect(finalRouteChoiceLabel(PilihanJalurFinal.TETAP_JALUR_ASAL)).toBe(
      "Tetap di jalur asal",
    );
    expect(finalRouteChoiceLabel(PilihanJalurFinal.JALUR_FALLBACK)).toBe(
      "Pindah ke jalur pilihan final",
    );
    expect(finalRouteChoiceLabel(null)).toBe("Belum memilih");
  });
});
