import { readFile } from "node:fs/promises";

import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

if (!process.env.DIRECT_URL) {
  throw new Error("DIRECT_URL wajib diisi untuk verifikasi migration.");
}

const initialMigrationSql = await readFile(
  new URL("./migrations/20260829030000_init/migration.sql", import.meta.url),
  "utf8",
);
const rlsMigrationSql = await readFile(
  new URL(
    "./migrations/20260829040000_enable_rls/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const validationSchema = `phase1_validation_${process.pid}`;
const client = new pg.Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await client.connect();

try {
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA "${validationSchema}"`);
  await client.query(`SET LOCAL search_path TO "${validationSchema}"`);
  await client.query(initialMigrationSql);
  await client.query(rlsMigrationSql);

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = $1",
    [validationSchema],
  );
  assert(tables.rowCount === 13, `Expected 13 tables, found ${tables.rowCount}.`);
  assert(
    tables.rows.some(({ table_name }) => table_name === "audit_log"),
    "Tabel audit_log tidak ditemukan.",
  );

  const indexes = await client.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname = $1",
    [validationSchema],
  );
  assert(indexes.rowCount >= 40, `Expected at least 40 indexes, found ${indexes.rowCount}.`);

  const domainConstraints = await client.query(
    "SELECT conname FROM pg_constraint WHERE connamespace = $1::regnamespace AND conname LIKE '%_check'",
    [validationSchema],
  );
  assert(
    domainConstraints.rowCount === 20,
    `Expected 20 domain constraints, found ${domainConstraints.rowCount}.`,
  );

  const rlsTables = await client.query(
    "SELECT COUNT(*)::int AS count FROM pg_class WHERE relnamespace = $1::regnamespace AND relkind = 'r' AND relrowsecurity",
    [validationSchema],
  );
  assert(
    rlsTables.rows[0].count === 13,
    `Expected RLS on 13 tables, found ${rlsTables.rows[0].count}.`,
  );

  await client.query("SAVEPOINT invalid_quota");
  try {
    await client.query(
      "INSERT INTO jalur (nama, kuota_maks, kuota_terpakai) VALUES ('Invalid', 1, 2)",
    );
    throw new Error("Constraint kuota tidak menolak data invalid.");
  } catch (error) {
    assert(error.code === "23514", "Constraint kuota tidak tervalidasi.");
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT invalid_quota");
  }

  const userId = "10000000-0000-4000-8000-000000000001";
  const jalurId = "20000000-0000-4000-8000-000000000001";
  const kategoriId = "30000000-0000-4000-8000-000000000001";
  const calonMuridId = "40000000-0000-4000-8000-000000000001";

  await client.query(
    "INSERT INTO users (id, supabase_auth_user_id, email) VALUES ($1, $2, $3)",
    [userId, "50000000-0000-4000-8000-000000000001", "phase1@example.test"],
  );
  await client.query("INSERT INTO jalur (id, nama) VALUES ($1, $2)", [
    jalurId,
    "Reguler",
  ]);
  await client.query(
    "INSERT INTO kategori_pendaftar (id, nama, tipe) VALUES ($1, $2, 'eksternal')",
    [kategoriId, "Eksternal/Umum"],
  );
  await client.query(
    "INSERT INTO calon_murid (id, user_id, nama_anak, jalur_id, kategori_id) VALUES ($1, $2, $3, $4, $5)",
    [calonMuridId, userId, "Data sementara", jalurId, kategoriId],
  );
  await client.query(
    "INSERT INTO pembayaran (calon_murid_id, calon_murid_reference, jenis, metode_pembayaran, nominal, midtrans_order_id, midtrans_snap_token) VALUES ($1, $1, 'pendaftaran', 'midtrans', 1000, 'phase1-order', 'phase1-token')",
    [calonMuridId],
  );
  await client.query("DELETE FROM calon_murid WHERE id = $1", [calonMuridId]);

  const retainedPayment = await client.query(
    "SELECT calon_murid_id, calon_murid_reference FROM pembayaran WHERE midtrans_order_id = 'phase1-order'",
  );
  assert(retainedPayment.rowCount === 1, "Ledger pembayaran ikut terhapus.");
  assert(
    retainedPayment.rows[0].calon_murid_id === null,
    "Relasi aktif pembayaran tidak dilepas.",
  );
  assert(
    retainedPayment.rows[0].calon_murid_reference === calonMuridId,
    "Referensi audit pembayaran tidak dipertahankan.",
  );

  console.log("Migration Phase 1 dan retention pembayaran tervalidasi.");
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
