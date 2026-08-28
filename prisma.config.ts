import "dotenv/config";

import { defineConfig } from "prisma/config";

const directUrl = process.env.DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Generate/validate tidak membutuhkan koneksi. Saat DIRECT_URL tersedia,
  // perintah database dan migration selalu memakai koneksi direct Supabase.
  ...(directUrl ? { datasource: { url: directUrl } } : {}),
});
