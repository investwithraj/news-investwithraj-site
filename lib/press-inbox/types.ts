// Press inbox — incoming press releases from PR firms to raj@news.investwithraj.com.
//
// Pattern: subscribe to PR mailing lists at the news mailbox, IMAP poller
// pulls unread emails on a daily cron, parses subject/sender/body/links,
// and drops a structured draft into content/press-inbound/ as JSON for
// review. Approved drafts get hand-rewritten into full NewsArticles.
//
// Why this matters: Modon, Aldar, Nakheel, Knight Frank, JLL, etc. all blast
// press releases to journalists/brokers daily. This is the lowest-friction
// way to ingest first-party news.

export type PressSenderTier =
  | "developer-tier-1"       // Modon, Emaar, Aldar, Nakheel, Dubai Holding, IFA, Damac
  | "advisor-tier-1"          // Knight Frank, JLL, CBRE, Savills, Cushman, Colliers
  | "advisor-tier-2"          // Asteco, Cavendish Maxwell, Property Monitor
  | "government"              // DLD, RERA, DMT, FCSC, CBUAE
  | "trade-pub"               // Khaleej Times, Gulf News, The National, Arabian Business
  | "industry-event"          // Cityscape, IPS, MIPIM Asia/MENA
  | "agency"                  // PR firms — Memac Ogilvy, Hill+Knowlton, Edelman MENA
  | "noise";                  // Spam / unrelated / low-tier

export interface PressEmail {
  /** IMAP message UID */
  uid: string;
  /** When the email arrived in the mailbox */
  receivedAt: string;
  /** From: header (raw) */
  fromRaw: string;
  /** Parsed sender name */
  fromName: string;
  /** Parsed sender email */
  fromEmail: string;
  /** Parsed sender domain — used to determine tier */
  fromDomain: string;
  /** Subject line */
  subject: string;
  /** Plain-text body (HTML stripped) */
  textBody: string;
  /** Raw HTML body (for image/link extraction) */
  htmlBody: string;
  /** Extracted URLs from the body */
  links: string[];
  /** Extracted attachments (filename + content-type, NOT content) */
  attachments: Array<{ filename: string; contentType: string; size: number }>;
  /** Auto-classified sender tier */
  tier: PressSenderTier;
  /** Auto-tagged keywords (developer names, project names, etc.) */
  tags: string[];
}

export interface PressDraft {
  /** Slug — auto-generated from subject + date */
  slug: string;
  /** Source email */
  source: PressEmail;
  /** Auto-extracted candidate headline (subject line cleaned) */
  candidateHeadline: string;
  /** Auto-extracted candidate dek (first 2 sentences of body) */
  candidateDek: string;
  /** Auto-extracted candidate citations (links found in body, deduped) */
  candidateCitations: Array<{ url: string; source: string }>;
  /** Score 0-1 — how worth-pursuing the pipeline thinks this is */
  relevanceScore: number;
  /** Pipeline reasoning */
  rationale: string;
  /** Status — awaiting review, accepted (turned into NewsArticle), rejected */
  status: "pending" | "accepted" | "rejected";
  /** ISO timestamp when this draft was created */
  draftedAt: string;
}

/** Domain → tier lookup. Used to triage incoming senders. */
export const SENDER_DOMAIN_TIERS: Record<string, PressSenderTier> = {
  // Developers
  "modon.ae": "developer-tier-1",
  "emaar.com": "developer-tier-1",
  "aldar.com": "developer-tier-1",
  "nakheel.com": "developer-tier-1",
  "dubaiholding.com": "developer-tier-1",
  "ifa.ae": "developer-tier-1",
  "damacproperties.com": "developer-tier-1",
  "marjan.ae": "developer-tier-1",
  // Advisors
  "knightfrank.com": "advisor-tier-1",
  "jll.com": "advisor-tier-1",
  "cbre.com": "advisor-tier-1",
  "savills.com": "advisor-tier-1",
  "cushmanwakefield.com": "advisor-tier-1",
  "colliers.com": "advisor-tier-1",
  "asteco.com": "advisor-tier-2",
  "cavendishmaxwell.com": "advisor-tier-2",
  "propertymonitor.ae": "advisor-tier-2",
  // Government
  "dubailand.gov.ae": "government",
  "dld.gov.ae": "government",
  "rera.gov.ae": "government",
  "dmt.gov.ae": "government",
  "fcsa.gov.ae": "government",
  "cbuae.gov.ae": "government",
  // Trade pubs
  "khaleejtimes.com": "trade-pub",
  "gulfnews.com": "trade-pub",
  "thenationalnews.com": "trade-pub",
  "arabianbusiness.com": "trade-pub",
  "zawya.com": "trade-pub",
  // Agencies
  "memacogilvy.com": "agency",
  "hkstrategies.com": "agency",
  "edelman.com": "agency",
  "actionprgroup.com": "agency",
};

/** Classify a sender domain. Defaults to "noise" if unknown. */
export function classifySender(email: string): PressSenderTier {
  const domain = email.toLowerCase().split("@")[1] || "";
  // Exact-match first
  if (SENDER_DOMAIN_TIERS[domain]) return SENDER_DOMAIN_TIERS[domain];
  // Then check if domain *ends with* any known suffix (handles sub-domains like info.modon.ae)
  for (const [known, tier] of Object.entries(SENDER_DOMAIN_TIERS)) {
    if (domain.endsWith("." + known) || domain.endsWith(known)) return tier;
  }
  return "noise";
}

/** Auto-extract keywords/tags from subject + body. Returns deduped lowercased list. */
const TAG_PATTERNS = [
  // Developers
  /\bmodon\b/i, /\bemaar\b/i, /\baldar\b/i, /\bnakheel\b/i, /\bdamac\b/i,
  /\bdubai holding\b/i, /\bifa hotels\b/i, /\bmarjan\b/i,
  // Projects
  /\bhudayriyat\b/i, /\bsaadiyat\b/i, /\bpalm jebel ali\b/i, /\bpalm jumeirah\b/i,
  /\bwynn\b/i, /\bal marjan\b/i, /\babu dhabi island\b/i, /\byas island\b/i,
  /\bdowntown dubai\b/i, /\bdubai marina\b/i, /\bbusiness bay\b/i, /\bjbr\b/i,
  // Asset types
  /\boff-?plan\b/i, /\bvilla\b/i, /\bbranded residence\b/i, /\bmansion\b/i,
  /\bpenthouse\b/i, /\bhotel\b/i, /\bresort\b/i, /\bcasino\b/i,
  // Indices
  /\bDLD\b/, /\bRERA\b/, /\bDXBinteract\b/i, /\bproperty finder\b/i, /\bbayut\b/i,
  // Macro
  /\bgolden visa\b/i, /\bcorporate tax\b/i, /\bvat\b/i, /\bvisa\b/i,
];

export function extractTags(subject: string, body: string): string[] {
  const text = `${subject} ${body}`;
  const found = new Set<string>();
  for (const pattern of TAG_PATTERNS) {
    const match = text.match(pattern);
    if (match) found.add(match[0].toLowerCase());
  }
  return Array.from(found);
}
