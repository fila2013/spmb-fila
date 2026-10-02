export function visibleEnrollmentFields<T extends { id: string; archivedAt: Date | null }>(
  fields: T[],
  submitted: boolean,
  answeredFieldIds: ReadonlySet<string>,
) {
  return fields.filter((field) => submitted
    ? answeredFieldIds.has(field.id)
    : field.archivedAt === null);
}
