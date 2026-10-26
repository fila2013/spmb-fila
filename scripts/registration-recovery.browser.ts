import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium, type Browser, expect as browserExpect } from "@playwright/test";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: vi.fn(), select: vi.fn(), birth: vi.fn(), create: vi.fn(), upload: vi.fn(), snap: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/calon-murid/service", () => ({ selectKategori: mocks.select, updateBirthDetails: mocks.birth, createCalonMuridWithJalur: mocks.create }));
vi.mock("@/lib/payment/service", () => ({ uploadManualRegistrationProof: mocks.upload, createRegistrationSnapPayment: mocks.snap }));
vi.mock("@/lib/env/server", () => ({ getMidtransEnvironment: () => ({ MIDTRANS_IS_PRODUCTION: false }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("Test navigation"), { testRedirect: url }); } }));

import { selectCategoryAction } from "../app/anak/actions";
import { POST as manual } from "../app/api/calon-murid/[id]/pembayaran/manual/route";
import { POST as midtrans } from "../app/api/calon-murid/[id]/pembayaran/midtrans/create/route";
import { CalonMuridError } from "../lib/calon-murid/errors";
import { PaymentError } from "../lib/payment/errors";
import { HOLD_EXPIRED_MESSAGE } from "../lib/quota-hold/rules";

const id = "10000000-0000-4000-8000-000000000001";
let browser: Browser;
let bundle: string;
let css: string;

beforeAll(async () => {
  const entry = [
    "import {createRoot} from 'react-dom/client';",
    "import {SelectCategoryForm} from './components/calon-murid/enrollment-forms';",
    "import {ManualRegistrationPaymentPanel} from './components/payment/manual-registration-payment-panel';",
    "import {SnapPaymentPanel} from './components/payment/snap-payment-panel';",
    "const id = " + JSON.stringify(id) + ";",
    "const query = new URL(location.href).searchParams;",
    "const expiresAt = new Date(Date.now() + (query.get('clock') === 'soon' ? 1500 : 60000)).toISOString();",
    "const category = {id, nama:'Eksternal/Umum', tipe:'EKSTERNAL', available:true, availabilityLabel:'Tersedia', quotaLabel:'1 kursi tersisa', feeConfigured:true, feeLabel:'Rp300.000'};",
    "const content = location.pathname.includes('/kategori')",
    "? <SelectCategoryForm childId={id} categories={[category]} renewingHold={query.has('hold')} initialSelection={query.has('hold') ? {kategoriId:id, subKategoriEnum:null, subKategoriText:'TK Uji'} : undefined} />",
    ": location.pathname === '/snap' ? <SnapPaymentPanel childId={id} expiresAt={expiresAt} clientKey='test-only' snapScriptUrl='https://no-network.test/snap.js' environment='sandbox' initialStatus={null} initialSnapToken={null} localWebhookWarning={false} />",
    ": location.pathname.includes('/enrollment/') ? <h1>Enrollment terbuka</h1>",
    ": <ManualRegistrationPaymentPanel childId={id} expiresAt={expiresAt} bankAccounts={[]} />;",
    "createRoot(document.getElementById('root')).render(content);",
  ].join("\n");
  const actionAdapter = [
    "export async function selectCategoryAction(_, body) {",
    "const data = await (await fetch('/test/category', {method:'POST', body})).json();",
    "if (data.redirect) location.assign(data.redirect);",
    "return data.state ?? {status:'idle'};",
    "}",
    "export const createChildWithRouteAction = selectCategoryAction;",
    "export const updateBirthDetailsAction = selectCategoryAction;",
  ].join("\n");
  const result = await build({
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: entry },
    plugins: [{ name: "test-boundaries", setup(builder) {
      builder.onResolve({ filter: /^@\/app\/anak\/actions$/ }, () => ({ path: "actions", namespace: "test" }));
      builder.onResolve({ filter: /^next\/(navigation|link|script)$/ }, ({ path }) => ({ path, namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ loader: "tsx", resolveDir: process.cwd(), contents: path === "actions" ? actionAdapter
        : path === "next/navigation" ? "export const useRouter = () => ({replace: url => location.assign(url), refresh: () => {}});"
          : path === "next/link" ? "export default function Link({href, children, ...props}) { return <a href={href} {...props}>{children}</a>; }"
            : "import {useEffect} from 'react'; export default function Script({onReady}) {useEffect(() => {onReady?.()}, []); return null;}" }));
    } }],
  });
  bundle = result.outputFiles[0].text;
  const root = join(process.cwd(), ".next/static/chunks");
  css = readdirSync(root, { recursive: true }).filter((path) => typeof path === "string" && path.endsWith(".css")).map((path) => readFileSync(join(root, String(path)), "utf8")).join("\n");
  browser = await chromium.launch(existsSync(chromium.executablePath()) ? { headless: true } : { channel: "chrome", headless: true });
});
afterAll(async () => { await browser?.close(); });
beforeEach(() => { vi.clearAllMocks(); mocks.role.mockResolvedValue({ userId: "wali-test" }); mocks.select.mockResolvedValue({ id }); });

async function testPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/*", async (route) => {
    const incoming = route.request();
    const url = new URL(incoming.url());
    if (url.origin !== "http://registration.test") return route.abort();
    if (url.pathname === "/bundle.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
    if (incoming.method() === "POST") {
      const bytes = incoming.postDataBuffer();
      const request = new Request(incoming.url(), { method: "POST", headers: incoming.headers(), body: bytes ? new Uint8Array(bytes) : null });
      let response: Response;
      if (url.pathname === "/test/category") {
        try { response = Response.json({ state: await selectCategoryAction({ status: "idle" }, await request.formData()) }); }
        catch (error) {
          if (!error || typeof error !== "object" || !("testRedirect" in error)) throw error;
          response = Response.json({ redirect: error.testRedirect });
        }
      } else response = await (url.pathname.endsWith("/manual") ? manual : midtrans)(request, { params: Promise.resolve({ id }) });
      return route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
    }
    return route.fulfill({ contentType: "text/html", body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style><main style="max-width:640px;margin:auto;padding:20px"><div id="root"></div></main><script src="/bundle.js"></script>' });
  });
  return { context, page: await context.newPage() };
}

describe("browser pendaftaran dan pemulihan pembayaran (terisolasi)", () => {
  it("menjaga state kategori saat error, mencetak diagnosis, meminta hold ulang dan membuka enrollment", async () => {
    const log = vi.spyOn(console, "error");
    const { context, page } = await testPage();
    try {
      await page.goto("http://registration.test/kategori");
      await page.getByRole("radio", { name: /Eksternal/ }).check();
      await page.getByRole("textbox", { name: "Nama asal TK" }).fill("TK Uji");
      mocks.select.mockRejectedValueOnce(new CalonMuridError("BIRTH_DETAILS_REQUIRED", "Data lahir belum tersimpan. Simpan data lahir terlebih dahulu.", 422));
      await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
      await browserExpect(page.getByRole("alert")).toContainText("Data lahir belum tersimpan");
      await browserExpect(page.getByRole("radio", { name: /Eksternal/ })).toBeChecked();
      await browserExpect(page.getByRole("textbox", { name: "Nama asal TK" })).toHaveValue("TK Uji");
      expect(log).toHaveBeenCalledWith("DEBUG selectCategoryAction ERROR:", expect.objectContaining({ code: "BIRTH_DETAILS_REQUIRED" }));
      await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
      await page.waitForURL(/pembayaran-pendaftaran$/);
      mocks.upload.mockRejectedValueOnce(new PaymentError("HOLD_EXPIRED", HOLD_EXPIRED_MESSAGE, 409));
      const proof = { name: "bukti-uji.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff]) };
      await page.locator('input[type="file"]').setInputFiles(proof);
      await page.getByRole("button", { name: "Kirim bukti & lanjutkan" }).click();
      await browserExpect(page.getByRole("alert")).toContainText("Hold kuota pembayaran sudah berakhir");
      await browserExpect(page.getByRole("button", { name: "Kirim bukti & lanjutkan" })).toBeDisabled();
      expect(log).toHaveBeenCalledWith("DEBUG Pembayaran ERROR:", expect.objectContaining({ code: "HOLD_EXPIRED" }));
      await page.screenshot({ path: ".next/registration-hold-recovery.png", fullPage: true });
      await page.getByRole("link", { name: "Periksa kuota & minta hold baru" }).click();
      await browserExpect(page.getByRole("radio", { name: /Eksternal/ })).toBeChecked();
      await browserExpect(page.getByRole("textbox", { name: "Nama asal TK" })).toHaveValue("TK Uji");
      await page.getByRole("button", { name: "Minta hold baru & lanjut ke pembayaran" }).click();
      await page.waitForURL(/pembayaran-pendaftaran$/);
      mocks.upload.mockResolvedValueOnce({ id: "payment-test", status: "VERIFIED", createdAt: new Date() });
      await page.locator('input[type="file"]').setInputFiles(proof);
      await page.getByRole("button", { name: "Kirim bukti & lanjutkan" }).click();
      await page.waitForURL(/enrollment\/data-pribadi$/);
      await browserExpect(page.getByRole("heading", { name: "Enrollment terbuka" })).toBeVisible();
    } finally { log.mockRestore(); await context.close(); }
  });

  it("timer mengunci unggah terlambat dan Midtrans menyediakan pemulihan untuk penolakan server", async () => {
    const { context, page } = await testPage();
    try {
      await page.goto("http://registration.test/payment?clock=soon");
      await browserExpect(page.getByRole("link", { name: "Periksa kuota & minta hold baru" })).toBeVisible();
      await browserExpect(page.locator('input[type="file"]')).toBeDisabled();
      expect(mocks.upload).not.toHaveBeenCalled();
      mocks.snap.mockRejectedValueOnce(new PaymentError("HOLD_EXPIRED", HOLD_EXPIRED_MESSAGE, 409));
      await page.goto("http://registration.test/snap");
      await page.getByRole("button", { name: "Bayar melalui Midtrans Sandbox" }).click();
      await browserExpect(page.getByRole("link", { name: "Periksa kuota & minta hold baru" })).toBeVisible();
      await browserExpect(page.getByRole("button", { name: "Bayar melalui Midtrans Sandbox" })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      mocks.snap.mockRejectedValueOnce(new PaymentError("HOLD_EXPIRING", "Sisa hold kurang dari 5 menit. Tunggu timer berakhir sebelum meminta hold baru.", 409));
      await page.goto("http://registration.test/snap");
      await page.getByRole("button", { name: "Bayar melalui Midtrans Sandbox" }).click();
      await browserExpect(page.getByText("Sisa hold kurang dari 5 menit. Tunggu timer berakhir sebelum meminta hold baru.")).toBeVisible();
      await browserExpect(page.getByRole("button", { name: "Bayar melalui Midtrans Sandbox" })).toBeDisabled();
      await browserExpect(page.getByRole("link", { name: "Periksa kuota & minta hold baru" })).toHaveCount(0);
    } finally { await context.close(); }
  });
});
