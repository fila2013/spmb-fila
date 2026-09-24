import { describe, expect, it } from "vitest";

import { latestJalurSelection } from "@/lib/master-data/action-state";

const databaseValue = {
  id: "jalur-tcp",
  fallbackJalurId: null,
  pilihanJalurFinalTargetId: null,
};

describe("master data action state", () => {
  it("menggunakan pilihan terbaru yang dikembalikan setelah jalur disimpan", () => {
    const savedValue = {
      id: databaseValue.id,
      fallbackJalurId: "jalur-reguler",
      pilihanJalurFinalTargetId: "jalur-pindahan",
    };

    expect(latestJalurSelection(databaseValue, savedValue)).toBe(savedValue);
  });

  it("menggunakan data database saat tidak ada hasil simpan untuk form ini", () => {
    const anotherFormValue = {
      id: "jalur-lain",
      fallbackJalurId: "jalur-reguler",
      pilihanJalurFinalTargetId: "jalur-pindahan",
    };

    expect(latestJalurSelection(databaseValue, anotherFormValue)).toBe(
      databaseValue,
    );
    expect(latestJalurSelection(databaseValue, undefined)).toBe(databaseValue);
  });
});
