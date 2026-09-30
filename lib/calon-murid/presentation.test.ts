import { describe, expect, it } from "vitest";

import { formatParticipantRegistrationDate } from "@/lib/calon-murid/presentation";

describe("tanggal pendaftaran peserta", () => {
  it("menampilkan tanggal dan jam dalam zona waktu Indonesia Barat", () => {
    expect(formatParticipantRegistrationDate(new Date("2026-09-29T07:30:00.000Z")))
      .toBe("29 Sep 2026, 14.30 WIB");
  });

  it("mengikuti tanggal kalender Jakarta saat UTC masih hari sebelumnya", () => {
    expect(formatParticipantRegistrationDate(new Date("2026-09-29T18:15:00.000Z")))
      .toBe("30 Sep 2026, 01.15 WIB");
  });
});
