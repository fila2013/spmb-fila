import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", override: true, quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const paymentBucket = process.env.SUPABASE_STORAGE_BUCKET_PEMBAYARAN;
const cmsBucket = process.env.SUPABASE_STORAGE_BUCKET_CMS;

if (!url || !key || !paymentBucket || !cmsBucket) {
  throw new Error("Environment Supabase Storage belum lengkap.");
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureBucket(
  id: string,
  options: { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] },
) {
  const { data, error } = await supabase.storage.getBucket(id);
  if (error && !/not found/i.test(error.message)) throw error;
  if (!data) {
    const created = await supabase.storage.createBucket(id, options);
    if (created.error) throw created.error;
    return "created";
  }
  const updated = await supabase.storage.updateBucket(id, options);
  if (updated.error) throw updated.error;
  return "updated";
}

const payment = await ensureBucket(paymentBucket, {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
});
const cms = await ensureBucket(cmsBucket, {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
});

console.log(`Storage buckets siap: pembayaran=${payment}, cms=${cms}.`);
