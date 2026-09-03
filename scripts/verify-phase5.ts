import { createHash, randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";
import {
  KategoriTipe,
  ModePembayaranPendaftaran,
  StatusKeseluruhan,
  StatusPembayaran,
} from "../generated/prisma/enums";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const serverKey = process.env.MIDTRANS_SERVER_KEY;
const merchantId = process.env.MIDTRANS_MERCHANT_ID;
const isProduction = process.env.MIDTRANS_IS_PRODUCTION;
const appUrl = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

if (!supabaseUrl || !publishableKey || !secretKey || !databaseUrl || !serverKey || !merchantId) {
  throw new Error("Environment integration test Phase 5 belum lengkap.");
}
if (isProduction !== "false") {
  throw new Error("Integration test Phase 5 hanya boleh dijalankan di Sandbox.");
}

const authUrl = supabaseUrl;
const publicKey = publishableKey;
const adminKey = secretKey;
const signingKey = serverKey;
const expectedMerchantId = merchantId;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const adminClient = createClient(authUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
const marker = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const authUserIds: string[] = [];
const profileIds: string[] = [];
const childIds: string[] = [];
let routeId: string | undefined;
let categoryId: string | undefined;
let feeId: string | undefined;
const initialPaymentSetting = await prisma.pengaturanPembayaran.findUniqueOrThrow({
  where: { id: "pendaftaran" },
});
const paymentModeChanged = initialPaymentSetting.mode !== ModePembayaranPendaftaran.MIDTRANS;

async function sessionCookie(accessToken: string, refreshToken: string) {
  const cookies = new Map<string, string>();
  const client = createServerClient(authUrl, publicKey, {
    cookies: {
      getAll: () => [],
      setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function createWali(label: string) {
  const email = `phase5-${label}-${marker}@example.invalid`;
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Gagal membuat akun uji.");
  authUserIds.push(data.user.id);
  const profile = await prisma.user.findUniqueOrThrow({ where: { supabaseAuthUserId: data.user.id } });
  profileIds.push(profile.id);
  const publicClient = createClient(authUrl, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: login, error: loginError } = await publicClient.auth.signInWithPassword({ email, password });
  if (loginError || !login.session) throw loginError ?? new Error("Login akun uji gagal.");
  const cookie = await sessionCookie(login.session.access_token, login.session.refresh_token);
  await publicClient.auth.signOut();
  return { profile, cookie };
}

async function api(path: string, init?: RequestInit, cookie?: string) {
  const response = await fetch(`${appUrl}${path}`, {
    ...init,
    headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { response, body };
}

function signedNotification(input: {
  orderId: string;
  amount: number;
  transactionStatus: string;
  statusCode: string;
  transactionId: string;
  merchant?: string;
}) {
  const grossAmount = `${input.amount}.00`;
  return {
    order_id: input.orderId,
    status_code: input.statusCode,
    gross_amount: grossAmount,
    transaction_status: input.transactionStatus,
    transaction_id: input.transactionId,
    payment_type: "bank_transfer",
    fraud_status: "accept",
    merchant_id: input.merchant ?? expectedMerchantId,
    currency: "IDR",
    signature_key: createHash("sha512")
      .update(`${input.orderId}${input.statusCode}${grossAmount}${signingKey}`)
      .digest("hex"),
    va_numbers: [{ bank: "bca", va_number: "should-not-be-stored" }],
  };
}

async function createPayment(childId: string, cookie: string) {
  return api(`/api/calon-murid/${childId}/pembayaran/midtrans/create`, { method: "POST" }, cookie);
}

try {
  if (paymentModeChanged) {
    await prisma.pengaturanPembayaran.update({
      where: { id: "pendaftaran" },
      data: { mode: ModePembayaranPendaftaran.MIDTRANS },
    });
  }
  const [wali, otherWali] = await Promise.all([createWali("owner"), createWali("other")]);
  const route = await prisma.jalur.create({ data: { nama: `Bayar ${marker}`, kuotaMaks: 5, kuotaTerpakai: 2 } });
  routeId = route.id;
  const category = await prisma.kategoriPendaftar.create({ data: { nama: `Bayar ${marker}`, tipe: KategoriTipe.EKSTERNAL, kuotaMaks: 5, kuotaTerpakai: 2 } });
  categoryId = category.id;
  const fee = await prisma.biayaPendaftaran.create({ data: { jalurId: route.id, kategoriId: category.id, nominal: 10_000 } });
  feeId = fee.id;
  const children = await Promise.all(
    ["Utama", "Retry"].map((name) =>
      prisma.calonMurid.create({
        data: {
          userId: wali.profile.id,
          namaAnak: `Anak ${name} ${marker}`,
          jalurId: route.id,
          kategoriId: category.id,
          subKategoriText: "TK Sandbox",
          statusKeseluruhan: StatusKeseluruhan.MENUNGGU_VERIFIKASI_BAYAR,
        },
      }),
    ),
  );
  childIds.push(...children.map(({ id }) => id));
  const [primary, retryChild] = children;

  const created = await createPayment(primary.id, wali.cookie);
  if (created.response.status !== 201) throw new Error(`Create Snap Sandbox gagal: ${created.response.status}`);
  const createdData = created.body.data as { snapToken?: string; orderId?: string; environment?: string };
  if (!createdData?.snapToken || !createdData.orderId || createdData.environment !== "sandbox") {
    throw new Error("Respons create Snap Sandbox tidak lengkap atau salah environment.");
  }
  const reused = await createPayment(primary.id, wali.cookie);
  const reusedData = reused.body.data as { snapToken?: string; orderId?: string; reused?: boolean };
  if (reused.response.status !== 200 || !reusedData.reused || reusedData.orderId !== createdData.orderId) {
    throw new Error("Create transaction belum idempotent.");
  }
  const ownership = await createPayment(primary.id, otherWali.cookie);
  if (ownership.response.status !== 403) throw new Error(`Ownership payment gagal: ${ownership.response.status}`);

  const invalidSignature = signedNotification({ orderId: createdData.orderId, amount: fee.nominal, transactionStatus: "pending", statusCode: "201", transactionId: randomUUID() });
  invalidSignature.signature_key = "0".repeat(128);
  const invalidResult = await api("/api/webhooks/midtrans", { method: "POST", body: JSON.stringify(invalidSignature) });
  if (invalidResult.response.status !== 403) throw new Error("Webhook signature invalid tidak ditolak.");

  const mismatch = signedNotification({ orderId: createdData.orderId, amount: fee.nominal + 1, transactionStatus: "settlement", statusCode: "200", transactionId: randomUUID() });
  const mismatchResult = await api("/api/webhooks/midtrans", { method: "POST", body: JSON.stringify(mismatch) });
  if (mismatchResult.response.status !== 422) throw new Error("Webhook nominal mismatch tidak ditolak.");

  const wrongMerchant = signedNotification({ orderId: createdData.orderId, amount: fee.nominal, transactionStatus: "pending", statusCode: "201", transactionId: randomUUID(), merchant: "M000000000" });
  const wrongMerchantResult = await api("/api/webhooks/midtrans", { method: "POST", body: JSON.stringify(wrongMerchant) });
  if (wrongMerchantResult.response.status !== 403) throw new Error("Webhook merchant mismatch tidak ditolak.");

  const transactionId = randomUUID();
  const pending = signedNotification({ orderId: createdData.orderId, amount: fee.nominal, transactionStatus: "pending", statusCode: "201", transactionId });
  const pendingResult = await api("/api/webhooks/midtrans", { method: "POST", body: JSON.stringify(pending) });
  if (pendingResult.response.status !== 200) throw new Error("Webhook pending gagal.");
  const payment = await prisma.pembayaran.findUniqueOrThrow({ where: { midtransOrderId: createdData.orderId } });
  const raw = payment.midtransRawPayload as Record<string, unknown>;
  if (raw.signature_key || raw.va_numbers) throw new Error("Payload sensitif webhook tersimpan.");
  const auditBeforeDuplicate = await prisma.auditLog.count({ where: { entityId: payment.id } });
  const pendingDuplicate = await api("/api/webhooks/midtrans", { method: "POST", body: JSON.stringify(pending) });
  if (pendingDuplicate.response.status !== 200 || pendingDuplicate.body.duplicate !== true) throw new Error("Webhook duplicate tidak idempotent.");
  const auditAfterDuplicate = await prisma.auditLog.count({ where: { entityId: payment.id } });
  if (auditAfterDuplicate !== auditBeforeDuplicate) throw new Error("Webhook duplicate membuat audit side effect.");

  const settlement = signedNotification({ orderId: createdData.orderId, amount: fee.nominal, transactionStatus: "settlement", statusCode: "200", transactionId });
  const settlementResult = await api("/api/webhooks/midtrans", { method: "POST", body: JSON.stringify(settlement) });
  if (settlementResult.response.status !== 200) throw new Error("Webhook settlement gagal.");
  const [verifiedPayment, enrolledChild] = await Promise.all([
    prisma.pembayaran.findUniqueOrThrow({ where: { id: payment.id } }),
    prisma.calonMurid.findUniqueOrThrow({ where: { id: primary.id } }),
  ]);
  if (verifiedPayment.status !== StatusPembayaran.VERIFIED || !verifiedPayment.verifiedAt || enrolledChild.statusKeseluruhan !== StatusKeseluruhan.ENROLLMENT) {
    throw new Error("Payment state transition atau enrollment gate gagal.");
  }
  const settlementAuditBeforeDuplicate = await prisma.auditLog.count({ where: { entityId: payment.id } });
  const settlementDuplicate = await api("/api/webhooks/midtrans", { method: "POST", body: JSON.stringify(settlement) });
  const settlementAuditAfterDuplicate = await prisma.auditLog.count({ where: { entityId: payment.id } });
  if (settlementDuplicate.response.status !== 200 || settlementDuplicate.body.duplicate !== true || settlementAuditAfterDuplicate !== settlementAuditBeforeDuplicate) {
    throw new Error("Webhook settlement duplicate belum idempotent.");
  }
  const statusResult = await api(`/api/calon-murid/${primary.id}/pembayaran`, undefined, wali.cookie);
  if (statusResult.response.status !== 200 || (statusResult.body.data as { status?: string })?.status !== StatusPembayaran.VERIFIED) {
    throw new Error("Polling status tidak mengembalikan verified.");
  }

  const retryFirst = await createPayment(retryChild.id, wali.cookie);
  const retryFirstData = retryFirst.body.data as { orderId?: string };
  if (retryFirst.response.status !== 201 || !retryFirstData.orderId) throw new Error("Transaksi retry pertama gagal dibuat.");
  const expired = signedNotification({ orderId: retryFirstData.orderId, amount: fee.nominal, transactionStatus: "expire", statusCode: "407", transactionId: randomUUID() });
  const expiredResult = await api("/api/webhooks/midtrans", { method: "POST", body: JSON.stringify(expired) });
  if (expiredResult.response.status !== 200) throw new Error("Webhook expire gagal.");
  const retrySecond = await createPayment(retryChild.id, wali.cookie);
  const retrySecondData = retrySecond.body.data as { orderId?: string };
  if (retrySecond.response.status !== 201 || !retrySecondData.orderId || retrySecondData.orderId === retryFirstData.orderId) {
    throw new Error("Retry tidak membuat payment attempt baru.");
  }
  const attemptCount = await prisma.pembayaran.count({ where: { calonMuridReference: retryChild.id } });
  if (attemptCount !== 2) throw new Error(`Ledger retry tidak lengkap: ${attemptCount}/2.`);

  console.log("Phase 5 Midtrans Sandbox integration: OK");
} finally {
  if (paymentModeChanged) {
    await prisma.pengaturanPembayaran.update({
      where: { id: "pendaftaran" },
      data: {
        mode: initialPaymentSetting.mode,
        updatedById: initialPaymentSetting.updatedById,
        updatedAt: initialPaymentSetting.updatedAt,
      },
    });
  }
  const payments = childIds.length
    ? await prisma.pembayaran.findMany({ where: { calonMuridReference: { in: childIds } }, select: { id: true } })
    : [];
  const auditEntityIds = [...childIds, ...payments.map(({ id }) => id)];
  if (auditEntityIds.length) await prisma.auditLog.deleteMany({ where: { entityId: { in: auditEntityIds } } });
  if (payments.length) await prisma.pembayaran.deleteMany({ where: { id: { in: payments.map(({ id }) => id) } } });
  if (childIds.length) await prisma.calonMurid.deleteMany({ where: { id: { in: childIds } } });
  if (feeId) await prisma.biayaPendaftaran.deleteMany({ where: { id: feeId } });
  if (routeId) await prisma.jalur.deleteMany({ where: { id: routeId } });
  if (categoryId) await prisma.kategoriPendaftar.deleteMany({ where: { id: categoryId } });
  if (profileIds.length) await prisma.user.deleteMany({ where: { id: { in: profileIds } } });
  for (const id of authUserIds) await adminClient.auth.admin.deleteUser(id);
  await prisma.$disconnect();
}
