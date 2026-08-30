import { describe, expect, it } from "vitest";

import { reportingExportSchema, reportingFilterSchema } from "@/lib/reporting/schemas";

describe("reporting schemas", () => {
  it("menerima filter gabungan dan format export", () => {
    const result = reportingExportSchema.parse({
      q: "Aisyah",
      jalurId: "00000000-0000-4000-8000-000000000001",
      statusPembayaran: "VERIFIED",
      statusEnrollment: "LENGKAP",
      statusKelulusan: "DITERIMA",
      format: "csv",
    });
    expect(result.format).toBe("csv");
    expect(result.statusPembayaran).toBe("VERIFIED");
  });

  it("menolak enum, UUID, dan query berlebih yang tidak valid", () => {
    expect(reportingFilterSchema.safeParse({ jalurId: "x" }).success).toBe(false);
    expect(reportingFilterSchema.safeParse({ statusDu: "LUNAS" }).success).toBe(false);
    expect(reportingFilterSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });

  it("mengubah nilai kosong menjadi tanpa filter", () => {
    expect(reportingFilterSchema.parse({ jalurId: "", statusWa: "" })).toEqual({});
  });
});
