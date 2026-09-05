import ExcelJS from "exceljs";

export const reportColumns = [
  "ID Peserta",
  "Nama Calon Murid",
  "Email Wali",
  "Jalur",
  "Jalur Asal",
  "Pilihan Jalur Final",
  "Tanggal Pilihan Jalur",
  "Kategori",
  "Subkategori",
  "Status Keseluruhan",
  "Status Enrollment",
  "Status Pembayaran Pendaftaran",
  "Nominal Pendaftaran",
  "Verifikasi Pendaftaran",
  "Status Assessment",
  "Hasil Pengumuman",
  "Tanggal Rilis",
  "Status DU",
  "Nominal DU",
  "Verifikasi DU",
  "Status Grup WhatsApp",
  "Tanggal Mendaftar",
] as const;

export type ReportRow = Record<(typeof reportColumns)[number], string | number>;

function neutralizeSpreadsheetFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function safeCell(value: string | number) {
  return typeof value === "string" ? neutralizeSpreadsheetFormula(value) : value;
}

export function createCsv(rows: ReportRow[]) {
  const escape = (value: string | number) => {
    const safe = String(safeCell(value));
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  const lines = [
    reportColumns.map(escape).join(","),
    ...rows.map((row) => reportColumns.map((column) => escape(row[column])).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export async function createXlsx(rows: ReportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SPMB Fila";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Rekap Peserta", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.columns = reportColumns.map((header) => ({
    header,
    key: header,
    width: header.includes("Nama") ? 26 : header.includes("Email") ? 30 : 22,
  }));
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: reportColumns.length },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
  worksheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
  worksheet.getRow(1).height = 32;

  for (const row of rows) {
    worksheet.addRow(Object.fromEntries(
      reportColumns.map((column) => [column, safeCell(row[column])]),
    ));
  }
  worksheet.getColumn("Nominal Pendaftaran").numFmt = '[$Rp-id-ID] #,##0';
  worksheet.getColumn("Nominal DU").numFmt = '[$Rp-id-ID] #,##0';
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
