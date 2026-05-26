// HTML email template builder for the daily digest.
// Email-client-safe: inline CSS only, table-based layout, no <style>
// blocks (Gmail/Outlook strip them aggressively).
//
// v11 navy/gold register applied. Mobile-responsive via fluid widths
// + max-widths instead of media queries (some clients ignore @media).

import { SITE } from "@/lib/constants";
import type { NewsArticle } from "@/content/news/types";
import type { CampaignDraft } from "./listmonk";

// Brand palette — inline values, no CSS vars (email clients don't resolve them)
const COL = {
  paper: "#F8FAFC",
  paperWarm: "#F9F6F0",
  ink: "#0A1024",
  inkSoft: "#1E2538",
  inkMuted: "#4A5570",
  gold: "#C9A961",
  goldDeep: "#A88945",
  goldBright: "#E0C076",
  chromeDeep: "#B8C2D0",
} as const;

/** Format a date as "Tuesday, 26 May 2026" for the digest header. */
function formatDigestDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Build a UTM-tagged article link for the digest CTA */
function articleLink(slug: string): string {
  const u = new URL(`${SITE.url}/news/${slug}`);
  u.searchParams.set("utm_source", "newsletter");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", "daily-digest");
  return u.toString();
}

/** UTM-tagged lead-back to investwithraj.com */
function rootLink(): string {
  const u = new URL(SITE.rootUrl);
  u.searchParams.set("utm_source", "newsletter");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", "daily-digest");
  u.searchParams.set("utm_content", "footer-cta");
  return u.toString();
}

/** Build the subject line for a digest run.
 *  Pattern: "Daily Read — Tuesday, 26 May · 5 articles" */
export function buildDigestSubject(articles: NewsArticle[], date = new Date()): string {
  const dateStr = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const count = articles.length;
  const word = count === 1 ? "article" : "articles";
  return `Daily Read — ${dateStr} · ${count} ${word}`;
}

/** Build the plain-text fallback body (for clients without HTML support). */
export function buildDigestTextBody(articles: NewsArticle[], date = new Date()): string {
  const header = `INVEST WITH RAJ — Daily Read\n${formatDigestDate(date)}\n\n────────────────────\n\n`;
  const items = articles
    .map((a, i) => {
      const num = String(i + 1).padStart(2, "0");
      return `${num}. ${a.title}\n${a.subtitle}\n→ ${articleLink(a.slug)}\n`;
    })
    .join("\n");
  const footer = `\n────────────────────\n\nThe 12-page institutional Note publishes monthly at:\n${rootLink()}\n\nReply to this email or WhatsApp +971 58 996 6085 to reach Raj directly.\n\nUnsubscribe: {{ UnsubscribeURL }}\n`;
  return header + items + footer;
}

/** Build the HTML body for the digest. */
export function buildDigestHtmlBody(
  articles: NewsArticle[],
  date = new Date()
): string {
  const articleRows = articles
    .map((a, i) => articleRow(a, i + 1))
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Daily Read — ${escapeHtml(formatDigestDate(date))}</title>
</head>
<body style="margin:0;padding:0;background:${COL.paperWarm};font-family:'Inter',Helvetica,Arial,sans-serif;color:${COL.ink};-webkit-text-size-adjust:100%;">

<!-- Preheader (hidden but shown in inbox preview) -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
${escapeHtml(articles[0]?.subtitle ?? "Daily UAE real-estate intelligence.")}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COL.paperWarm};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- Container — max 600px, fluid below that -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid ${COL.gold}33;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid ${COL.gold}33;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>
                  <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${COL.goldDeep};">Beyond the Deal</div>
                  <div style="font-family:'Georgia','Times New Roman',serif;font-style:italic;font-size:18px;color:${COL.ink};margin-top:6px;">Daily Read</div>
                </td>
                <td align="right" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;color:${COL.inkMuted};letter-spacing:0.15em;">
                  ${escapeHtml(formatDigestDate(date))}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Articles -->
        <tr>
          <td style="padding:8px 32px;">
            ${articleRows}
          </td>
        </tr>

        <!-- Footer CTA -->
        <tr>
          <td style="padding:24px 32px;background:${COL.ink};color:${COL.paper};border-top:2px solid ${COL.gold};">
            <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${COL.goldBright};margin-bottom:8px;">The Notes</div>
            <div style="font-family:'Georgia','Times New Roman',serif;font-style:italic;font-size:20px;line-height:1.3;color:${COL.paper};margin-bottom:14px;">
              The 12-page institutional Note publishes monthly.
            </div>
            <a href="${rootLink()}" style="display:inline-block;background:${COL.gold};color:${COL.ink};text-decoration:none;padding:11px 22px;border-radius:999px;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;">
              Request the current Note →
            </a>
          </td>
        </tr>

        <!-- Sub-footer -->
        <tr>
          <td style="padding:18px 32px;background:${COL.paperWarm};text-align:center;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:${COL.inkMuted};">
            Raj Tomar · DLD-Licensed Broker · Dubai<br />
            Reply to this email or WhatsApp <a href="https://wa.me/971589966085" style="color:${COL.goldDeep};text-decoration:none;">+971 58 996 6085</a> to reach Raj directly.<br />
            <br />
            <a href="{{ UnsubscribeURL }}" style="color:${COL.inkMuted};text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp; <a href="${SITE.url}" style="color:${COL.inkMuted};text-decoration:none;">news.investwithraj.com</a>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

/** Single-article row markup */
function articleRow(article: NewsArticle, num: number): string {
  const numStr = String(num).padStart(2, "0");
  const link = articleLink(article.slug);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;border-bottom:1px solid ${COL.chromeDeep}33;padding-bottom:20px;">
  <tr>
    <td style="padding-bottom:6px;">
      <span style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${COL.goldDeep};">${numStr} · ${escapeHtml(article.category)}</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:10px;">
      <a href="${link}" style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:20px;font-weight:600;line-height:1.3;color:${COL.ink};text-decoration:none;">${escapeHtml(article.title)}</a>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;">
      <div style="font-family:'Inter',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:${COL.inkSoft};">
        ${escapeHtml(article.subtitle)}
      </div>
    </td>
  </tr>
  <tr>
    <td>
      <a href="${link}" style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COL.goldDeep};text-decoration:none;">
        Read the full read →
      </a>
    </td>
  </tr>
</table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * One-call helper: build subject + html + text from an article list.
 * Returned object plugs straight into sendListmonkDigest().
 */
export function buildDigestDraft(
  articles: NewsArticle[],
  date = new Date()
): CampaignDraft {
  return {
    subject: buildDigestSubject(articles, date),
    htmlBody: buildDigestHtmlBody(articles, date),
    textBody: buildDigestTextBody(articles, date),
    contentType: "richtext",
  };
}
