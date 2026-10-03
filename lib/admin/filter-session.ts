export const adminFilterSession = {
  peserta: {
    path: "/admin/peserta",
    storageKey: "spmb:admin:peserta:filters",
    fields: ["q", "jalurId", "kategoriId", "statusKeseluruhan"],
  },
  laporan: {
    path: "/admin/laporan",
    storageKey: "spmb:admin:laporan:filters",
    fields: [
      "q",
      "jalurId",
      "kategoriId",
      "statusKeseluruhan",
      "statusPembayaran",
      "statusEnrollment",
      "statusAssessment",
      "statusKelulusan",
      "statusDu",
      "statusWa",
    ],
  },
} as const;

export type AdminFilterPage = keyof typeof adminFilterSession;

export const adminFilterStorageKeys = Object.values(adminFilterSession).map(
  ({ storageKey }) => storageKey,
);

export function hasFilterKeys(params: URLSearchParams, fields: readonly string[]) {
  return fields.some((field) => params.has(field));
}

export function serializeFilterValues(
  values: { get(name: string): unknown },
  fields: readonly string[],
) {
  const params = new URLSearchParams();

  for (const field of fields) {
    const raw = values.get(field);
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value && value.length <= 100) params.set(field, value);
  }

  return params.toString();
}

export function saveFilterSession(
  storage: Pick<Storage, "setItem" | "removeItem">,
  storageKey: string,
  values: { get(name: string): unknown },
  fields: readonly string[],
) {
  const query = serializeFilterValues(values, fields);
  if (query) storage.setItem(storageKey, query);
  else storage.removeItem(storageKey);
}

export function clearFilterSessions(
  storage: Pick<Storage, "removeItem">,
  keys: readonly string[] = adminFilterStorageKeys,
) {
  for (const key of keys) storage.removeItem(key);
}

export function restoredFilterUrl(
  path: string,
  current: URLSearchParams,
  stored: string | null,
  fields: readonly string[],
) {
  if (hasFilterKeys(current, fields) || !stored) return null;

  const saved = serializeFilterValues(new URLSearchParams(stored), fields);
  if (!saved) return null;

  const next = new URLSearchParams(current);
  for (const [field, value] of new URLSearchParams(saved)) next.set(field, value);
  return `${path}?${next.toString()}`;
}
