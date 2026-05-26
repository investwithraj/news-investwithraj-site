// Listmonk REST API client. Self-hosted on Hetzner CX22 + AWS SES on
// news.investwithraj.com us-east-1 (per project_listmonk_migration.md).
//
// Required env vars on Vercel:
//   LISTMONK_BASE_URL — https://listmonk.investwithraj.com (or whatever the user wires)
//   LISTMONK_API_USERNAME — Listmonk API user (Settings → Users → Create API user)
//   LISTMONK_API_TOKEN — API token for that user
//   LISTMONK_DIGEST_LIST_ID — numeric ID of the "Beyond the Deal Daily Digest" list
//   LISTMONK_FROM_EMAIL — e.g. raj@news.investwithraj.com
//   LISTMONK_FROM_NAME — "Raj Tomar"
//   LISTMONK_TEMPLATE_ID — optional, numeric ID of a saved Listmonk template
//
// No-ops gracefully when env vars not set — same pattern as the Postiz +
// Telegram + Discord clients.

const LM_BASE = process.env.LISTMONK_BASE_URL || "";
const LM_USER = process.env.LISTMONK_API_USERNAME || "";
const LM_TOKEN = process.env.LISTMONK_API_TOKEN || "";
const LM_LIST_ID = process.env.LISTMONK_DIGEST_LIST_ID || "";
const LM_FROM_EMAIL = process.env.LISTMONK_FROM_EMAIL || "";
const LM_FROM_NAME = process.env.LISTMONK_FROM_NAME || "Raj Tomar";
const LM_TEMPLATE_ID = process.env.LISTMONK_TEMPLATE_ID || "";

export function isListmonkConfigured(): boolean {
  return Boolean(LM_BASE && LM_USER && LM_TOKEN && LM_LIST_ID && LM_FROM_EMAIL);
}

/** Basic-auth header for Listmonk API calls */
function authHeader(): string {
  return `Basic ${Buffer.from(`${LM_USER}:${LM_TOKEN}`).toString("base64")}`;
}

export interface CampaignDraft {
  subject: string;
  /** Plain-text fallback body (for clients that can't render HTML) */
  textBody: string;
  /** Full HTML body — built by digest-builder.ts */
  htmlBody: string;
  /** Listmonk template type — "richtext" for fully self-contained HTML */
  contentType?: "html" | "richtext" | "plain" | "markdown";
}

export interface ListmonkResult {
  ok: boolean;
  /** Listmonk campaign ID when created */
  campaignId?: number;
  /** Status that was set ("draft" or "running") */
  status?: string;
  message: string;
}

/**
 * Create a campaign draft in Listmonk. Returns the campaign ID for
 * subsequent status changes (e.g. set to "running" to send immediately).
 */
export async function createListmonkCampaign(
  draft: CampaignDraft
): Promise<ListmonkResult> {
  if (!isListmonkConfigured()) {
    return {
      ok: false,
      message:
        "Listmonk not configured (LISTMONK_BASE_URL + LISTMONK_API_USERNAME + LISTMONK_API_TOKEN + LISTMONK_DIGEST_LIST_ID + LISTMONK_FROM_EMAIL env vars missing). Skipped.",
    };
  }

  const payload: Record<string, unknown> = {
    name: draft.subject,
    subject: draft.subject,
    lists: [parseInt(LM_LIST_ID, 10)],
    from_email: `${LM_FROM_NAME} <${LM_FROM_EMAIL}>`,
    type: "regular",
    content_type: draft.contentType || "richtext",
    body: draft.htmlBody,
    altbody: draft.textBody,
    messenger: "email",
    tags: ["daily-digest", "beyond-the-deal"],
  };

  if (LM_TEMPLATE_ID) {
    payload.template_id = parseInt(LM_TEMPLATE_ID, 10);
  }

  try {
    const res = await fetch(`${LM_BASE}/api/campaigns`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        message: `Listmonk createCampaign returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as { data?: { id?: number } };
    if (!data.data?.id) {
      return { ok: false, message: "Listmonk response missing campaign ID" };
    }

    return {
      ok: true,
      campaignId: data.data.id,
      status: "draft",
      message: `Created campaign ${data.data.id}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unknown Listmonk error",
    };
  }
}

/** Set a Listmonk campaign's status — "running" sends immediately. */
export async function setCampaignStatus(
  campaignId: number,
  status: "running" | "draft" | "paused" | "scheduled" | "cancelled"
): Promise<ListmonkResult> {
  if (!isListmonkConfigured()) {
    return { ok: false, message: "Listmonk not configured. Skipped." };
  }

  try {
    const res = await fetch(`${LM_BASE}/api/campaigns/${campaignId}/status`, {
      method: "PUT",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        campaignId,
        message: `Listmonk setStatus returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    return {
      ok: true,
      campaignId,
      status,
      message: `Set campaign ${campaignId} → ${status}`,
    };
  } catch (e) {
    return {
      ok: false,
      campaignId,
      message: e instanceof Error ? e.message : "Unknown Listmonk error",
    };
  }
}

/**
 * Convenience: create + immediately send a campaign (one-call flow for cron).
 * Returns the campaign ID + final status.
 */
export async function sendListmonkDigest(
  draft: CampaignDraft
): Promise<ListmonkResult> {
  const created = await createListmonkCampaign(draft);
  if (!created.ok || !created.campaignId) return created;

  const sent = await setCampaignStatus(created.campaignId, "running");
  if (!sent.ok) {
    return {
      ok: false,
      campaignId: created.campaignId,
      status: "draft",
      message: `Campaign ${created.campaignId} created but failed to send: ${sent.message}`,
    };
  }

  return {
    ok: true,
    campaignId: created.campaignId,
    status: "running",
    message: `Campaign ${created.campaignId} created + sent`,
  };
}
