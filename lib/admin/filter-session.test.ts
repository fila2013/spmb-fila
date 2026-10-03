import { describe, expect, it } from "vitest";

import {
  adminFilterSession,
  adminFilterStorageKeys,
  clearFilterSessions,
  hasFilterKeys,
  restoredFilterUrl,
  saveFilterSession,
  serializeFilterValues,
} from "@/lib/admin/filter-session";

describe("admin filter session", () => {
  it("menyimpan hanya filter Peserta yang terisi dan mengabaikan parameter lain", () => {
    const { fields } = adminFilterSession.peserta;
    expect(serializeFilterValues(new URLSearchParams({
      q: "  Aisyah  ",
      jalurId: "jalur-1",
      kategoriId: "",
      statusKeseluruhan: "MENUNGGU_ASSESSMENT",
      deleted: "1",
    }), fields)).toBe("q=Aisyah&jalurId=jalur-1&statusKeseluruhan=MENUNGGU_ASSESSMENT");
  });

  it("memulihkan semua filter Laporan saat kembali melalui menu tanpa query", () => {
    const { path, fields } = adminFilterSession.laporan;
    const saved = serializeFilterValues(new URLSearchParams({
      q: "Budi",
      jalurId: "jalur-1",
      kategoriId: "kategori-1",
      statusKeseluruhan: "SELESAI",
      statusPembayaran: "VERIFIED",
      statusEnrollment: "LENGKAP",
      statusAssessment: "LULUS",
      statusKelulusan: "DITERIMA",
      statusDu: "VERIFIED",
      statusWa: "BERGABUNG",
    }), fields);
    const target = restoredFilterUrl(path, new URLSearchParams(), saved, fields);
    expect(target).not.toBeNull();
    const restored = new URL(target!, "https://example.test");
    expect(restored.pathname).toBe(path);
    expect(Object.fromEntries(restored.searchParams)).toEqual(Object.fromEntries(new URLSearchParams(saved)));
  });

  it("memprioritaskan filter eksplisit dari URL dan mempertahankan query non-filter", () => {
    const { path, fields } = adminFilterSession.peserta;
    expect(restoredFilterUrl(path, new URLSearchParams("q=Baru"), "q=Lama", fields)).toBeNull();
    expect(hasFilterKeys(new URLSearchParams("q="), fields)).toBe(true);
    expect(restoredFilterUrl(path, new URLSearchParams("deleted=1"), "q=Lama", fields))
      .toBe("/admin/peserta?deleted=1&q=Lama");
  });

  it("mempertahankan filter saat berpindah menu, lalu reset dan logout membersihkannya", () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => { items.set(key, value); },
      removeItem: (key: string) => { items.delete(key); },
    };
    const peserta = adminFilterSession.peserta;
    const laporan = adminFilterSession.laporan;
    saveFilterSession(storage, peserta.storageKey, new URLSearchParams("q=Aisyah&jalurId=jalur-1"), peserta.fields);
    saveFilterSession(storage, laporan.storageKey, new URLSearchParams("q=Budi&statusEnrollment=LENGKAP"), laporan.fields);
    expect(restoredFilterUrl(peserta.path, new URLSearchParams(), storage.getItem(peserta.storageKey), peserta.fields))
      .toBe("/admin/peserta?q=Aisyah&jalurId=jalur-1");
    expect(restoredFilterUrl(laporan.path, new URLSearchParams(), storage.getItem(laporan.storageKey), laporan.fields))
      .toBe("/admin/laporan?q=Budi&statusEnrollment=LENGKAP");
    clearFilterSessions(storage, [peserta.storageKey]);
    expect(storage.getItem(peserta.storageKey)).toBeNull();
    expect(storage.getItem(laporan.storageKey)).not.toBeNull();
    clearFilterSessions(storage);
    expect(storage.getItem(laporan.storageKey)).toBeNull();
    expect(adminFilterStorageKeys).toEqual([
      adminFilterSession.peserta.storageKey,
      adminFilterSession.laporan.storageKey,
    ]);
  });

  it("mengabaikan isi storage yang rusak atau terlalu panjang", () => {
    const { path, fields } = adminFilterSession.peserta;
    expect(restoredFilterUrl(path, new URLSearchParams(), "unknown=1", fields)).toBeNull();
    expect(restoredFilterUrl(path, new URLSearchParams(), `q=${"a".repeat(101)}`, fields)).toBeNull();
  });
});
