import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const root = process.cwd();
const baseUrl = "http://127.0.0.1:3000";
const integrationOnly = process.argv.includes("--integration-only");
const e2eOnly = process.argv.includes("--e2e-only");
const scripts = [
  "verify-auth-profile.ts",
  "verify-phase3.ts",
  "verify-phase4.ts",
  "verify-phase5.ts",
  "verify-dynamic-registration-payment.ts",
  "verify-phase6.ts",
  "verify-phase7.ts",
  "verify-phase8.ts",
  "verify-phase9.ts",
  "verify-phase10.ts",
  "verify-admin-deletion.ts",
];

if (process.env.MIDTRANS_IS_PRODUCTION !== "false") {
  throw new Error("Phase 11 hanya boleh dijalankan dengan Midtrans Sandbox (MIDTRANS_IS_PRODUCTION=false).");
}

const environment = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: baseUrl,
  PLAYWRIGHT_BASE_URL: baseUrl,
  PHASE11_SERVER_STARTED: "1",
};

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n[Phase 11] ${label}`);
    const child = spawn(command, args, { cwd: root, env: environment, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${label} gagal dengan exit code ${code}.`)));
  });
}

async function serverReady() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js berhenti sebelum siap (exit ${child.exitCode}).`);
    if (await serverReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next.js tidak siap dalam 120 detik.");
}

async function main() {
  await access(path.join(root, ".next", "BUILD_ID"));
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  const playwrightCli = path.join(root, "node_modules", "@playwright", "test", "cli.js");
  let server = null;

  if (!await serverReady()) {
    console.log("[Phase 11] Menjalankan Next.js production server...");
    server = spawn(process.execPath, [nextBin, "start", "-p", "3000"], {
      cwd: root,
      env: environment,
      stdio: "inherit",
      shell: false,
    });
    await waitForServer(server);
  } else {
    console.log("[Phase 11] Menggunakan server yang sudah aktif di 127.0.0.1:3000.");
  }

  const stopServer = () => {
    if (server && server.exitCode === null) server.kill("SIGTERM");
  };
  process.once("SIGINT", () => { stopServer(); process.exitCode = 130; });
  process.once("SIGTERM", () => { stopServer(); process.exitCode = 143; });

  try {
    if (!e2eOnly) {
      await run(process.execPath, [path.join(root, "prisma", "verify-migration.mjs")], "Verifikasi migration staging");
      for (const script of scripts) {
        await run(process.execPath, [tsxCli, path.join(root, "scripts", script), baseUrl], `Integration ${script}`);
      }
    }
    if (!integrationOnly) {
      await run(process.execPath, [playwrightCli, "test"], "E2E Chromium");
    }
    console.log("\n[Phase 11] Seluruh quality gate staging lulus.");
  } finally {
    stopServer();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
