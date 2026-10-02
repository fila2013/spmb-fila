import { describe, expect, it } from "vitest";

import { visibleEnrollmentFields } from "@/lib/enrollment/field-visibility";

const fields = [
  { id: "legacy", archivedAt: new Date("2026-10-02T00:00:00.000Z") },
  { id: "place", archivedAt: null },
  { id: "date", archivedAt: null },
];

describe("visibleEnrollmentFields", () => {
  it("menampilkan field baru dan menyembunyikan field lama pada draft", () => {
    expect(visibleEnrollmentFields(fields, false, new Set(["legacy"])).map((field) => field.id)).toEqual(["place", "date"]);
  });

  it("menampilkan hanya jawaban historis pada enrollment yang sudah dikunci", () => {
    expect(visibleEnrollmentFields(fields, true, new Set(["legacy"])).map((field) => field.id)).toEqual(["legacy"]);
  });
});
