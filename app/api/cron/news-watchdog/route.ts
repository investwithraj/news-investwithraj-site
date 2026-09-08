import { NextRequest } from "next/server";

import { runNewsWatchdog } from "@/lib/news-scheduler/watchdog";
import {
  authorizeServerMutation,
  privateJson,
} from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (process.env.ENABLE_NEWS_WATCHDOG !== "1") {
    const receipt = await runNewsWatchdog();
    return privateJson(receipt, receipt.httpStatus);
  }
  const auth = authorizeServerMutation(request, { allowCronBearer: true });
  if (!auth.ok) return auth.response;
  if (auth.credential !== "cron") {
    return privateJson(
      { error: "The news watchdog requires the Vercel Cron bearer credential." },
      403,
    );
  }

  const receipt = await runNewsWatchdog();
  return privateJson(receipt, receipt.httpStatus);
}
