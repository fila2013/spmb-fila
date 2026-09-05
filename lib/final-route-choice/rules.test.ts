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
  it("meminta pilihan hanya untuk hasil diterima dengan fitur dan fallback aktif", () => {
    expect(
      releasedStatusAfterAcceptedDecision({
        statusAkhir: StatusPengumuman.DITERIMA,
        finalChoiceEnabled: true,
        fallbackJalurId: "reguler",
      }),
    ).toBe(StatusKeseluruhan.MENUNGGU_PILIHAN_JALUR);
    expect(
      releasedStatusAfterAcceptedDecision({
        statusAkhir: StatusPengumuman.DITERIMA,
        finalChoiceEnabled: false,
        fallbackJalurId: "reguler",
      }),
    ).toBe(StatusKeseluruhan.DITERIMA);
  });

  it("tidak mengubah alur peserta yang tidak diterima", () => {
    expect(
      releasedStatusAfterAcceptedDecision({
        statusAkhir: StatusPengumuman.TIDAK_DITERIMA,
        finalChoiceEnabled: true,
        fallbackJalurId: "reguler",
      }),
    ).toBe(StatusKeseluruhan.TIDAK_DITERIMA);
  });

  it("memberikan label pilihan yang ramah pengguna", () => {
    expect(finalRouteChoiceLabel(PilihanJalurFinal.TETAP_JALUR_ASAL)).toBe(
      "Tetap di jalur asal",
    );
    expect(finalRouteChoiceLabel(null)).toBe("Belum memilih");
  });
});
