import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { createCsv, createXlsx, reportColumns, type ReportRow } from "@/lib/reporting/export";

function row(overrides: Partial<ReportRow> = {}): ReportRow {
  return Object.assign(
    Object.fromEntries(reportColumns.map((column) => [column, ""])) as ReportRow,
    overrides,
  );
}

describe("reporting exports", () => {
  it("menghasilkan CSV BOM, escaping RFC, dan netralisasi formula", () => {
    const csv = createCsv([row({
      "Nama Calon Murid": "=HYPERLINK(\"https://example.invalid\")",
      "Email Wali": "wali,contoh@example.invalid",
    })]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"wali,contoh@example.invalid"');
  });

  it("menghasilkan workbook XLSX valid dan teks aman", async () => {
    const bytes = await createXlsx([row({
      "Nama Calon Murid": "+CMD",
      "Nominal DU": 2_500_000,
    })]);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
    const worksheet = workbook.getWorksheet("Rekap Peserta");
    expect(worksheet?.getCell("B2").value).toBe("'+CMD");
    expect(worksheet?.getCell("S2").value).toBe(2_500_000);
    expect(worksheet?.autoFilter).toBeTruthy();
  });
});
