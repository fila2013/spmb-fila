import { getCronEnvironment } from "@/lib/env/server";
import { expireRegistrationQuotaHolds } from "@/lib/quota-hold/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { CRON_SECRET } = getCronEnvironment();
  if (request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Cron tidak diizinkan." } },
      { status: 401 },
    );
  }

  const result = await expireRegistrationQuotaHolds();
  return Response.json({ success: true, ...result });
}
