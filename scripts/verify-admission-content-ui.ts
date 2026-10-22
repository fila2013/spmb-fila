// Isolated browser verification with synthetic HTML; no Auth or database writes.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";

import { StageContentBlocks } from "../components/stages/stage-content";

const inviteUrl = "https://chat.whatsapp.com/Browser_Test_Group_1234567890";
const tutorialTitle = "Tutorial Cara Pembayaran Daftar Ulang";
const markup = renderToStaticMarkup(createElement("main", { style: { maxWidth: 600, padding: 16, margin: "auto" } },
  createElement(StageContentBlocks, { whatsappMode: true, content: [{ id: "join", judul: "Informasi Grup WhatsApp", tanggal: null, isiTeks: `Silakan bergabung melalui ${inviteUrl}.`, gambarUrl: null, youtubeVideoId: null, urutanLayout: 0 }] }),
  createElement(StageContentBlocks, { tutorialMode: true, content: [{ id: "demo", judul: "Informasi Daftar Ulang", tanggal: null, isiTeks: "Petunjuk pembayaran dari panitia.", gambarUrl: null, youtubeVideoId: "dQw4w9WgXcQ", judulTutorial: tutorialTitle, urutanLayout: 0 }] }),
));
const cssRoot = join(process.cwd(), ".next/static/chunks");
const css = readdirSync(cssRoot, { recursive: true }).filter((path) => typeof path === "string" && path.endsWith(".css")).map((path) => readFileSync(join(cssRoot, String(path)), "utf8")).join("\n");
const browser = await chromium.launch(existsSync(chromium.executablePath()) ? { headless: true } : { headless: true, channel: "chrome" });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/*", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Test destination</title>" }));
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>`);
  for (const label of [inviteUrl, "Gabung Grup WhatsApp"]) {
    const link = page.getByRole("link", { name: label, exact: true });
    assert.equal(await link.getAttribute("href"), inviteUrl);
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
    const popupPromise = page.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    assert.equal(popup.url(), inviteUrl);
    await popup.close();
  }
  assert.equal(await page.getByRole("heading", { name: tutorialTitle }).isVisible(), true);
  const iframe = page.locator("iframe");
  assert.equal(await iframe.getAttribute("title"), tutorialTitle);
  assert.match(await iframe.getAttribute("src") ?? "", /^https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ\?/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: ".next/admission-ui-verification.png", fullPage: true });
  console.log("Browser Chromium 390px: link URL + CTA membuka tab tujuan, judul/iframe tutorial tampil, layout tanpa overflow: OK");
} finally {
  await browser.close();
}
