"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/v16/GlassCard";
import DataPanel from "@/components/v16/DataPanel";
import { AuroraBackground } from "@/components/futurism/AuroraBackground";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";
import { SemaformLayout } from "@/components/article/SemaformLayout";
import type { NewsArticle } from "@/content/news/types";
import type { NewsDraft, ProvenanceSource } from "@/lib/news-review/types";

/* ───────────────────────────────────────────────────────────────────────
   "The Desk" — the editorial review cockpit. Cinematic, built from the v16
   library, at public-site calibre. Source-verification (gold numbers ↔ their
   source) is the hero interaction, because a fabricated figure is the known
   failure. Nothing publishes until Raj ticks "figures verified" AND the 8
   gates pass. No native prompt/alert/confirm anywhere.
   ─────────────────────────────────────────────────────────────────────── */

interface Stats {
  awaiting: number;
  publishedToday: number;
  publishedThisWeek: number;
  avgConfidence: number;
}

const GATE_NAMES: Record<number, string> = {
  1: "Banned lexicon",
  2: "Approved lexicon",
  3: "Headline ≤90",
  4: "P1 has a number",
  5: "Citation whitelist",
  6: "Forbidden patterns",
  7: "Word count",
  8: "Em-dash voice",
};

// Figures: currency/number runs with optional unit. Used to glow numbers gold.
const NUMBER_RE =
  /(?:AED|USD|Dh|\$|€|£)?\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|bps|bn|mn|billion|million|sqft|sq\.?\s?ft|M|B|K))?/gi;

function digitsOf(s: string): string {
  return s.replace(/[^\d]/g, "");
}

/** Is this figure's digit-core attributed to a source — either present in a
 *  provenance source summary, or inside the text the drafter cited (citedText)? */
function figureBacked(figure: string, sources: ProvenanceSource[], citedText = ""): boolean {
  const core = digitsOf(figure);
  if (core.length < 2) return true; // single digits ("3 beats") — don't nag
  if (citedText && digitsOf(citedText).includes(core)) return true;
  return sources.some((s) => digitsOf(s.summary).includes(core));
}

export default function ReviewDesk({
  drafts,
  backend,
  stats,
}: {
  drafts: NewsDraft[];
  backend: string;
  stats: Stats;
}) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 800px at 50% -10%, #0d1530 0%, #070b18 55%, #05070f 100%)",
        color: "var(--v16-paper, #FBFBFC)",
        overflow: "hidden",
        fontFamily: "var(--v16-font-body), system-ui, sans-serif",
      }}
    >
      <AuroraBackground opacity={0.35} speed={0.6} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1180px",
          margin: "0 auto",
          padding: "72px 24px 120px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
              fontFamily: "var(--v16-font-mono), monospace",
              fontSize: "0.6875rem",
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "var(--v16-holo-blue, #5BA5F5)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--v16-holo-blue, #5BA5F5)",
                boxShadow: "0 0 10px var(--v16-holo-blue, #5BA5F5)",
              }}
            />
            news.investwithraj.com · editorial desk · {backend}
            <a
              href="/internal/dashboard"
              style={{ marginLeft: "auto", color: "var(--v16-ink-faint, #9AA0AB)", textDecoration: "none" }}
            >
              outreach queue →
            </a>
          </div>
          <KineticHeadline
            as="h1"
            style={{
              fontFamily: "var(--v16-font-display), Georgia, serif",
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            The Desk
          </KineticHeadline>
          <p
            style={{
              marginTop: "14px",
              maxWidth: "60ch",
              color: "var(--v16-ink-soft, #C8CDD3)",
              fontSize: "1.02rem",
              lineHeight: 1.55,
            }}
          >
            Every draft below is AI-written, gate-checked, and waiting on you. Verify each
            figure against its source, then publish. Nothing goes live under your name until
            you say so.
          </p>
        </div>

        {/* Instrument row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginBottom: "48px",
          }}
        >
          <DataPanel
            variant="holo"
            eyebrow="Awaiting review"
            value={String(stats.awaiting)}
          />
          <DataPanel
            variant="dark"
            eyebrow="Validator avg"
            value={`${stats.avgConfidence}%`}
            delta={{
              value: stats.avgConfidence >= 80 ? "healthy" : "check",
              trend: stats.avgConfidence >= 80 ? "up" : "flat",
            }}
          />
          <DataPanel variant="dark" eyebrow="Published today" value={String(stats.publishedToday)} />
          <DataPanel
            variant="dark"
            eyebrow="Published / 7d"
            value={String(stats.publishedThisWeek)}
          />
        </div>

        {/* Drafts */}
        {drafts.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {drafts.map((d) => (
              <DraftSlab key={d.id} draft={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <GlassCard variant="dark" padding="lg" style={{ textAlign: "center", padding: "56px 32px" }}>
      <p
        style={{
          fontFamily: "var(--v16-font-display), Georgia, serif",
          fontSize: "1.5rem",
          marginBottom: "10px",
        }}
      >
        The desk is clear.
      </p>
      <p style={{ color: "var(--v16-ink-faint, #9AA0AB)", fontSize: "0.95rem", lineHeight: 1.6 }}>
        The morning run posts the day&apos;s drafts here around 07:00 GST. When one lands,
        it&apos;ll appear as a slab to verify and publish.
      </p>
    </GlassCard>
  );
}

/* ─── One draft ───────────────────────────────────────────────────────── */

type View = "verify" | "preview" | "edit";

function DraftSlab({ draft }: { draft: NewsDraft }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [view, setView] = useState<View>("verify");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmStage, setConfirmStage] = useState<"publish" | "reject" | null>(null);
  const [figuresVerified, setFiguresVerified] = useState(false);
  const [activeSource, setActiveSource] = useState<string | null>(null);

  // Editable copy for the Edit view.
  const [edit, setEdit] = useState({
    title: draft.article.title,
    subtitle: draft.article.subtitle,
    body: draft.article.body,
  });

  const v = draft.validator;
  const blockedGates = useMemo(
    () => new Set(v.failures.filter((f) => f.severity === "block").map((f) => f.gate)),
    [v],
  );
  const warnGates = useMemo(
    () => new Set(v.failures.filter((f) => f.severity === "warn").map((f) => f.gate)),
    [v],
  );
  const gatesPassed = 8 - blockedGates.size;
  const confidence = Math.round((gatesPassed / 8) * 100);

  // Figures flagged as not-found-in-any-source (the fabrication signal).
  const unbackedCount = useMemo(() => {
    const figs = draft.article.body.match(NUMBER_RE) ?? [];
    const cited = draft.provenance.citedText ?? "";
    return figs.filter(
      (f) => digitsOf(f).length >= 2 && !figureBacked(f, draft.provenance.sources, cited),
    ).length;
  }, [draft]);

  const canPublish = v.ok && figuresVerified;

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function api(path: string, method: string, body?: unknown) {
    const res = await fetch(path, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function saveEdit() {
    setBusy("save");
    try {
      await api(`/api/news/draft/${draft.id}`, "PATCH", {
        article: { ...draft.article, ...edit },
      });
      flash("Saved ✓ — re-validated");
      startTransition(() => router.refresh());
      setView("verify");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function doPublish() {
    setBusy("publish");
    try {
      const r = await api(`/api/news/draft/${draft.id}/publish`, "POST");
      flash(`Published ✓ → ${r.slug}`);
      startTransition(() => router.refresh());
    } catch (e) {
      flash(e instanceof Error ? e.message : "Publish failed");
      setConfirmStage(null);
    } finally {
      setBusy(null);
    }
  }

  async function doReject() {
    setBusy("reject");
    try {
      await api(`/api/news/draft/${draft.id}`, "DELETE");
      flash("Rejected — draft cleared");
      startTransition(() => router.refresh());
    } catch (e) {
      flash(e instanceof Error ? e.message : "Reject failed");
      setConfirmStage(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <GlassCard variant="holo" padding="none" style={{ overflow: "hidden" }}>
      {/* Header band */}
      <div style={{ padding: "24px 24px 18px", display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <ConfidenceArc pct={confidence} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
            <Chip tone="gold">{draft.article.category}</Chip>
            <Chip tone="holo">score {draft.provenance.score}</Chip>
            <Chip tone="muted">draft · review</Chip>
            {unbackedCount > 0 && <Chip tone="warn">{unbackedCount} figure(s) to check</Chip>}
          </div>
          <h2
            style={{
              fontFamily: "var(--v16-font-display), Georgia, serif",
              fontSize: "clamp(1.4rem, 2.6vw, 2rem)",
              fontWeight: 500,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              margin: 0,
              color: "var(--v16-ink, #0A0E14)",
            }}
          >
            {draft.article.title}
          </h2>
          <p style={{ marginTop: "6px", color: "var(--v16-ink-muted, #5A6470)", fontSize: "0.95rem" }}>
            {draft.article.subtitle}
          </p>
        </div>
      </div>

      {/* Validator constellation + metrics */}
      <div
        style={{
          padding: "0 24px 18px",
          display: "flex",
          gap: "18px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "7px" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => {
            const tone = blockedGates.has(g) ? "#FF6B6B" : warnGates.has(g) ? "#E0A33B" : "#3FCF8E";
            return (
              <span
                key={g}
                title={`Gate ${g} — ${GATE_NAMES[g]}: ${blockedGates.has(g) ? "FAIL" : warnGates.has(g) ? "warn" : "pass"}`}
                style={{
                  width: "11px",
                  height: "11px",
                  borderRadius: "3px",
                  background: tone,
                  boxShadow: `0 0 8px ${tone}80`,
                }}
              />
            );
          })}
        </div>
        <MetricRow
          items={[
            [`${v.metrics.wordCount}`, "words"],
            [`${v.metrics.headlineLength}c`, "headline"],
            [`${v.metrics.approvedLexiconCount}`, "voice"],
            [`${v.metrics.citationsFromWhitelist}/${v.metrics.citationCount}`, "cites"],
            [v.metrics.p1HasNumber ? "yes" : "no", "p1 #"],
            [`${v.metrics.emDashCount}`, "em-dash"],
          ]}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "2px", padding: "0 24px", borderBottom: "1px solid var(--v16-chrome, rgba(255,255,255,0.08))" }}>
        {(["verify", "preview", "edit"] as View[]).map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${view === t ? "var(--v16-holo-blue, #5BA5F5)" : "transparent"}`,
              color: view === t ? "var(--v16-ink, #0A0E14)" : "var(--v16-ink-muted, #5A6470)",
              fontFamily: "var(--v16-font-mono), monospace",
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {t === "verify" ? "Verify figures" : t}
          </button>
        ))}
      </div>

      {/* Body of the active view */}
      <div style={{ padding: "24px", background: "var(--v16-paper-pure, #fff)", color: "var(--v16-ink, #0A0E14)" }}>
        {view === "verify" && (
          <VerifySplit
            draft={draft}
            activeSource={activeSource}
            setActiveSource={setActiveSource}
          />
        )}
        {view === "preview" && (
          <div style={{ borderRadius: "12px", overflow: "hidden", background: "#fff" }}>
            <SemaformLayout article={{ ...draft.article, status: "live" } as NewsArticle} />
          </div>
        )}
        {view === "edit" && (
          <EditForm edit={edit} setEdit={setEdit} onSave={saveEdit} busy={busy === "save"} />
        )}
      </div>

      {/* Verify gate + actions */}
      <div
        style={{
          padding: "18px 24px 24px",
          background: "var(--v16-ink-card, #14181F)",
          borderTop: "1px solid var(--v16-ink-card-border, rgba(255,255,255,0.06))",
        }}
      >
        {/* The human gate */}
        <button
          onClick={() => setFiguresVerified((s) => !s)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            marginBottom: "14px",
          }}
        >
          <span
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "6px",
              border: `1.5px solid ${figuresVerified ? "#3FCF8E" : "var(--v16-ink-faint, #9AA0AB)"}`,
              background: figuresVerified ? "#3FCF8E" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#05070f",
              fontSize: "0.8rem",
              boxShadow: figuresVerified ? "0 0 12px #3FCF8E80" : "none",
              transition: "all 200ms var(--v16-ease-out, ease)",
            }}
          >
            {figuresVerified ? "✓" : ""}
          </span>
          <span style={{ fontSize: "0.85rem", color: "var(--v16-paper, #FBFBFC)" }}>
            I&apos;ve checked every figure against its source
            {unbackedCount > 0 && (
              <span style={{ color: "#E0A33B" }}> — {unbackedCount} not found in any source</span>
            )}
          </span>
        </button>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Approve & publish */}
          {confirmStage === "publish" ? (
            <>
              <PillButton tone="confirm" busy={busy === "publish"} onClick={doPublish}>
                {busy === "publish" ? "Publishing…" : "Confirm — go live"}
              </PillButton>
              <PillButton tone="ghost" onClick={() => setConfirmStage(null)}>
                Cancel
              </PillButton>
            </>
          ) : (
            <PillButton
              tone="primary"
              disabled={!canPublish}
              onClick={() => setConfirmStage("publish")}
              title={
                !v.ok
                  ? "Validator gates must pass first"
                  : !figuresVerified
                    ? "Tick the figures-checked box first"
                    : "Publish this article live"
              }
            >
              Approve &amp; publish
            </PillButton>
          )}

          {/* Reject */}
          {confirmStage === "reject" ? (
            <>
              <PillButton tone="danger" busy={busy === "reject"} onClick={doReject}>
                {busy === "reject" ? "Rejecting…" : "Confirm reject"}
              </PillButton>
              <PillButton tone="ghost" onClick={() => setConfirmStage(null)}>
                Cancel
              </PillButton>
            </>
          ) : (
            <PillButton tone="ghost" onClick={() => setConfirmStage("reject")}>
              Reject
            </PillButton>
          )}

          <span style={{ marginLeft: "auto" }}>
            <LaunchConsole distribution={draft.article.distribution} />
          </span>
        </div>

        {!v.ok && (
          <p style={{ marginTop: "12px", fontSize: "0.78rem", color: "#FF8C8C" }}>
            Blocked: {v.failures.filter((f) => f.severity === "block").map((f) => f.name).join(" · ")}.
            Fix in Edit, then re-check.
          </p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 50,
            padding: "12px 18px",
            borderRadius: "10px",
            background: "var(--v16-ink-card, #14181F)",
            border: "1px solid var(--v16-holo-blue, #5BA5F5)",
            color: "var(--v16-paper, #FBFBFC)",
            fontFamily: "var(--v16-font-mono), monospace",
            fontSize: "0.8rem",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 20px var(--v16-holo-glow, rgba(91,165,245,0.2))",
          }}
        >
          {toast}
        </div>
      )}
    </GlassCard>
  );
}

/* ─── Verify split: reading column + source rail ──────────────────────── */

function VerifySplit({
  draft,
  activeSource,
  setActiveSource,
}: {
  draft: NewsDraft;
  activeSource: string | null;
  setActiveSource: (u: string | null) => void;
}) {
  const sources = draft.provenance.sources;
  const citedText = draft.provenance.citedText ?? "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: "24px" }} className="desk-verify-grid">
      {/* Reading column */}
      <div style={{ maxWidth: "62ch" }}>
        <p
          style={{
            fontFamily: "var(--v16-font-mono), monospace",
            fontSize: "0.62rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--v16-holo-deep, #2563EB)",
            marginBottom: "12px",
          }}
        >
          Draft body — figures glow gold
        </p>
        {draft.article.body.split(/\n\n+/).map((para, i) => (
          <p key={i} style={{ marginBottom: "14px", lineHeight: 1.7, fontSize: "1rem", color: "var(--v16-ink-soft, #2A3038)" }}>
            {highlightFigures(para, sources, setActiveSource, citedText)}
          </p>
        ))}
      </div>

      {/* Source rail */}
      <div>
        <p
          style={{
            fontFamily: "var(--v16-font-mono), monospace",
            fontSize: "0.62rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--v16-holo-deep, #2563EB)",
            marginBottom: "12px",
          }}
        >
          {sources.length} source{sources.length === 1 ? "" : "s"}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {sources.length === 0 && (
            <p style={{ fontSize: "0.85rem", color: "var(--v16-ink-muted, #5A6470)" }}>
              No source cluster attached to this draft.
            </p>
          )}
          {sources.map((s) => {
            const active = activeSource === s.url;
            return (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={() => setActiveSource(s.url)}
                onMouseLeave={() => setActiveSource(null)}
                style={{
                  display: "block",
                  padding: "14px",
                  borderRadius: "12px",
                  textDecoration: "none",
                  background: "var(--v16-paper-pure, #fff)",
                  border: `1px solid ${active ? "var(--v16-holo-blue, #5BA5F5)" : "var(--v16-chrome, #E8EBEE)"}`,
                  boxShadow: active ? "0 0 22px var(--v16-holo-glow, rgba(91,165,245,0.25))" : "none",
                  transition: "all 180ms var(--v16-ease-out, ease)",
                  transform: active ? "translateY(-1px)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--v16-ink, #0A0E14)" }}>{s.name}</span>
                  <span
                    style={{
                      fontFamily: "var(--v16-font-mono), monospace",
                      fontSize: "0.58rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--v16-holo-deep, #2563EB)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.tier}
                  </span>
                </div>
                <p style={{ fontSize: "0.8rem", lineHeight: 1.5, color: "var(--v16-ink-muted, #5A6470)", margin: 0 }}>
                  {s.summary.slice(0, 220)}
                  {s.summary.length > 220 ? "…" : ""}
                </p>
              </a>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 760px) {
          .desk-verify-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/** Split a paragraph into text + gold figure marks. Hovering a figure lights
 *  the source whose summary contains its digits. */
function highlightFigures(
  text: string,
  sources: ProvenanceSource[],
  setActiveSource: (u: string | null) => void,
  citedText = "",
) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(NUMBER_RE.source, "gi");
  const citedDigits = digitsOf(citedText);
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    const fig = m[0];
    if (!/\d/.test(fig)) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    const core = digitsOf(fig);
    const inCited = core.length >= 2 && citedDigits.includes(core);
    const match = sources.find((s) => digitsOf(s.summary).includes(core));
    const backed = core.length < 2 || inCited || Boolean(match);
    out.push(
      <mark
        key={`f${key++}`}
        onMouseEnter={() => match && setActiveSource(match.url)}
        onMouseLeave={() => setActiveSource(null)}
        style={{
          background: backed ? "rgba(201,169,97,0.18)" : "rgba(224,163,59,0.12)",
          color: backed ? "var(--v16-brass-deep, #8B6F2E)" : "#A86A1F",
          padding: "0 3px",
          borderRadius: "4px",
          borderBottom: `1.5px solid ${backed ? "var(--v16-brass, #C9A961)" : "#E0A33B"}`,
          cursor: match ? "help" : "default",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
        title={backed ? "Found in a source — hover to highlight it" : "Not found in any attached source — verify manually"}
      >
        {fig}
      </mark>,
    );
    last = m.index + fig.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ─── Edit form ───────────────────────────────────────────────────────── */

function EditForm({
  edit,
  setEdit,
  onSave,
  busy,
}: {
  edit: { title: string; subtitle: string; body: string };
  setEdit: (e: { title: string; subtitle: string; body: string }) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const field: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "var(--v16-paper-cool, #F4F6F9)",
    border: "1px solid var(--v16-chrome, #E8EBEE)",
    borderRadius: "8px",
    fontFamily: "inherit",
    fontSize: "0.95rem",
    color: "var(--v16-ink, #0A0E14)",
    marginBottom: "14px",
  };
  return (
    <div>
      <Label>Headline</Label>
      <input style={field} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
      <Label>Subtitle</Label>
      <input style={field} value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} />
      <Label>Body</Label>
      <textarea
        style={{ ...field, minHeight: "320px", lineHeight: 1.6, resize: "vertical" }}
        value={edit.body}
        onChange={(e) => setEdit({ ...edit, body: e.target.value })}
      />
      <PillButton tone="primary" busy={busy} onClick={onSave}>
        {busy ? "Saving…" : "Save & re-validate"}
      </PillButton>
    </div>
  );
}

/* ─── Small parts ─────────────────────────────────────────────────────── */

function ConfidenceArc({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const tone = pct >= 88 ? "#3FCF8E" : pct >= 60 ? "#E0A33B" : "#FF6B6B";
  return (
    <div style={{ position: "relative", width: "64px", height: "64px", flexShrink: 0 }}>
      <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ filter: `drop-shadow(0 0 4px ${tone})`, transition: "stroke-dasharray 700ms var(--v16-ease-display, ease)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--v16-font-display), Georgia, serif",
          fontSize: "1rem",
          fontWeight: 500,
          color: "var(--v16-ink, #0A0E14)",
        }}
      >
        {pct}
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "gold" | "holo" | "muted" | "warn" }) {
  const map = {
    gold: { bg: "rgba(201,169,97,0.16)", fg: "#8B6F2E", bd: "rgba(201,169,97,0.5)" },
    holo: { bg: "rgba(91,165,245,0.14)", fg: "#2563EB", bd: "rgba(91,165,245,0.5)" },
    muted: { bg: "rgba(90,100,112,0.12)", fg: "#5A6470", bd: "rgba(90,100,112,0.3)" },
    warn: { bg: "rgba(224,163,59,0.16)", fg: "#A86A1F", bd: "rgba(224,163,59,0.5)" },
  }[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: "999px",
        background: map.bg,
        color: map.fg,
        border: `1px solid ${map.bd}`,
        fontFamily: "var(--v16-font-mono), monospace",
        fontSize: "0.6rem",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function MetricRow({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      {items.map(([val, label]) => (
        <span key={label} style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: "var(--v16-font-display), Georgia, serif",
              fontSize: "1.05rem",
              fontWeight: 500,
              color: "var(--v16-ink, #0A0E14)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {val}
          </span>
          <span
            style={{
              fontFamily: "var(--v16-font-mono), monospace",
              fontSize: "0.56rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--v16-ink-muted, #5A6470)",
              marginTop: "3px",
            }}
          >
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontFamily: "var(--v16-font-mono), monospace",
        fontSize: "0.6rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "var(--v16-ink-muted, #5A6470)",
        marginBottom: "6px",
      }}
    >
      {children}
    </label>
  );
}

function LaunchConsole({ distribution }: { distribution: NewsArticle["distribution"] }) {
  const channels: { label: string; on: boolean }[] = [
    { label: "IndexNow", on: true },
    { label: "Telegram", on: Boolean(distribution?.telegram) },
    { label: "LinkedIn", on: Boolean(distribution?.postiz?.linkedin) },
    { label: "Listmonk", on: false },
  ];
  return (
    <span style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
      {channels.map((c) => (
        <span
          key={c.label}
          title={c.on ? "Will fan out on publish" : "Not configured — dormant"}
          style={{
            fontFamily: "var(--v16-font-mono), monospace",
            fontSize: "0.58rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: "999px",
            color: c.on ? "#3FCF8E" : "var(--v16-ink-faint, #9AA0AB)",
            border: `1px solid ${c.on ? "rgba(63,207,142,0.4)" : "rgba(154,160,171,0.25)"}`,
            background: c.on ? "rgba(63,207,142,0.1)" : "transparent",
            opacity: c.on ? 1 : 0.6,
          }}
        >
          {c.label}
        </span>
      ))}
    </span>
  );
}

function PillButton({
  children,
  onClick,
  tone,
  disabled,
  busy,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone: "primary" | "confirm" | "danger" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  title?: string;
}) {
  const map = {
    primary: { bg: "var(--v16-holo-blue, #5BA5F5)", fg: "#05070f", bd: "transparent" },
    confirm: { bg: "#3FCF8E", fg: "#05070f", bd: "transparent" },
    danger: { bg: "#FF6B6B", fg: "#1a0606", bd: "transparent" },
    ghost: { bg: "transparent", fg: "var(--v16-ink-faint, #9AA0AB)", bd: "rgba(255,255,255,0.18)" },
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      style={{
        padding: "11px 20px",
        borderRadius: "999px",
        background: map.bg,
        color: map.fg,
        border: `1px solid ${map.bd}`,
        fontFamily: "var(--v16-font-mono), monospace",
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: disabled || busy ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 160ms var(--v16-ease-out, ease)",
      }}
    >
      {children}
    </button>
  );
}
