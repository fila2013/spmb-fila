import { AdminDeletionError } from "@/lib/admin-deletion/errors";

export function deletionConfirmation(label: string) {
  return `HAPUS ${label}`;
}

export function assertDeletionConfirmed(
  label: string,
  confirmation: string | null | undefined,
) {
  const expected = deletionConfirmation(label);
  if (confirmation !== expected) {
    throw new AdminDeletionError(
      "DELETE_CONFIRMATION_REQUIRED",
      `Ketik \"${expected}\" untuk mengonfirmasi penghapusan permanen.`,
      409,
    );
  }
}

export function assertGuardianHasNoChildren(childCount: number) {
  if (childCount > 0) {
    throw new AdminDeletionError(
      "GUARDIAN_HAS_CHILDREN",
      "Akun wali hanya dapat dihapus setelah seluruh peserta/anak dihapus satu per satu.",
      409,
    );
  }
}
