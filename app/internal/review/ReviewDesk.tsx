"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SemaformLayout } from "@/components/article/SemaformLayout";
import type { NewsArticle } from "@/content/news/types";
import type { NewsDraft } from "@/lib/news-review/types";

import styles from "./ReviewDesk.module.css";

interface Stats {
  awaiting: number;
  publishedToday: number;
  publishedThisWeek: number;
  avgConfidence: number;
}

const GATE_NAMES: Record<number, string> = {
  1: "Banned lexicon",
  2: "Approved lexicon",
  3: "Headline length",
  4: "Opening evidence",
  5: "Citation whitelist",
  6: "Forbidden patterns",
  7: "Word count",
  8: "Editorial voice",
};

const NUMBER_RE =
  /(?:AED|USD|Dh|\$|€|£)?\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|bps|bn|mn|billion|million|sqft|sq\.?\s?ft|M|B|K))?/gi;

function digitsOf(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function figureBacked(
  figure: string,
  evidence: NonNullable<NewsDraft["provenance"]["fetchedEvidence"]>,
): boolean {
  const core = digitsOf(figure);
  if (core.length < 2) return true;
  return evidence.some((record) => digitsOf(record.text).includes(core));
}

export default function ReviewDesk({
  drafts,
  backend,
  stats,
  error,
}: {
  drafts: NewsDraft[];
  backend: string;
  stats: Stats;
  error?: string;
}) {
  const statItems = [
    ["Awaiting review", String(stats.awaiting)],
    ["Validator average", `${stats.avgConfidence}%`],
    ["Published today", String(stats.publishedToday)],
    ["Published in 7 days", String(stats.publishedThisWeek)],
  ];

  return (
    <main className={styles.desk}>
      <header className={styles.header}>
        <div className={styles.register}>
          <span>Internal · Editorial review · {backend}</span>
          <a href="/internal/dashboard">Open outreach queue →</a>
        </div>
        <div className={styles.titleRow}>
          <div>
            <p>Human publication gate</p>
            <h1>The Desk</h1>
          </div>
          <p>
            Verify the source record, edit the draft and make the publishing
            decision. Automation cannot approve an article in Raj&apos;s name.
          </p>
        </div>
      </header>

      <div className={styles.frame}>
        {error ? (
          <section className={styles.error} role="alert">
            <strong>Draft store unavailable</strong>
            <p>{error}</p>
          </section>
        ) : null}

        <section className={styles.stats} aria-label="Editorial review status">
          {statItems.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        {drafts.length === 0 ? (
          <section className={styles.empty}>
            <span>{error ? "Unavailable" : "Queue clear"}</span>
            <h2>{error ? "No state has been inferred." : "No drafts await review."}</h2>
            <p>
              {error
                ? "Restore the configured draft store, then reload this page."
                : "A new draft appears here only after it has been staged by the newsroom pipeline."}
            </p>
          </section>
        ) : (
          <section className={styles.drafts} aria-label="Drafts awaiting review">
            {drafts.map((draft) => (
              <DraftCard
                key={`${draft.id}:${draft.recordVersion}`}
                draft={draft}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

type View = "verify" | "preview" | "edit";

function DraftCard({ draft }: { draft: NewsDraft }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [view, setView] = useState<View>("verify");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmStage, setConfirmStage] = useState<
    "publish" | "reject" | null
  >(null);
  const [verifiedSources, setVerifiedSources] = useState(
    draft.verifiedSources ?? [],
  );
  const [evidenceApprovalHash, setEvidenceApprovalHash] = useState(
    draft.evidenceApproval?.hash ?? "",
  );
  const [revision, setRevision] = useState(draft.revision);
  const [recordVersion, setRecordVersion] = useState(draft.recordVersion);
  const [contentHash, setContentHash] = useState(draft.contentHash);
  const [mediaApproval, setMediaApproval] = useState(draft.mediaApproval);
  const [mediaRecord, setMediaRecord] = useState({
    sourceUrl: draft.mediaApproval?.sourceUrl ?? "",
    rightsStatus: draft.mediaApproval?.rightsStatus ?? "",
    credit: draft.mediaApproval?.credit ?? "",
  });
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    title: draft.article.title,
    subtitle: draft.article.subtitle,
    body: draft.article.body,
  });

  const validator = draft.validator;
  const blockedGates = useMemo(
    () =>
      new Set(
        validator.failures
          .filter((failure) => failure.severity === "block")
          .map((failure) => failure.gate),
      ),
    [validator],
  );
  const warningGates = useMemo(
    () =>
      new Set(
        validator.failures
          .filter((failure) => failure.severity === "warn")
          .map((failure) => failure.gate),
      ),
    [validator],
  );
  const confidence = Math.round(((8 - blockedGates.size) / 8) * 100);
  const unbackedCount = useMemo(() => {
    const figures = draft.article.body.match(NUMBER_RE) ?? [];
    const evidence = draft.provenance.fetchedEvidence ?? [];
    return figures.filter(
      (figure) =>
        digitsOf(figure).length >= 2 &&
        !figureBacked(figure, evidence),
    ).length;
  }, [draft]);
  const citationUrls = draft.article.citations.map(
    (citation) => citation.url,
  );
  const allSourcesVerified =
    citationUrls.length >= 2 &&
    citationUrls.every((url) => verifiedSources.includes(url));
  const figuresVerified = unbackedCount === 0;
  const mediaApprovalHash = mediaApproval?.hash ?? "";
  const canPublish =
    validator.ok &&
    figuresVerified &&
    allSourcesVerified &&
    Boolean(evidenceApprovalHash) &&
    Boolean(mediaApprovalHash);

  function showMessage(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(null), 3_000);
  }

  async function callApi(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : `Request failed (${response.status})`,
      );
    }
    return payload;
  }

  async function saveEdit() {
    setBusy("save");
    try {
      const payload = await callApi(`/api/news/draft/${encodeURIComponent(draft.id)}`, "PATCH", {
        expectedRevision: revision,
        expectedRecordVersion: recordVersion,
        expectedContentHash: contentHash,
        article: { ...draft.article, ...edit },
      });
      const updated = payload.draft as NewsDraft | undefined;
      if (!updated) throw new Error("The updated draft was not returned.");
      setRevision(updated.revision);
      setRecordVersion(updated.recordVersion);
      setContentHash(updated.contentHash);
      setVerifiedSources(updated.verifiedSources ?? []);
      setEvidenceApprovalHash(updated.evidenceApproval?.hash ?? "");
      setMediaApproval(updated.mediaApproval);
      showMessage("Draft saved and re-validated.");
      setView("verify");
      startTransition(() => router.refresh());
    } catch (caught) {
      showMessage(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("publish");
    try {
      const payload = await callApi(
        `/api/news/draft/${encodeURIComponent(draft.id)}/publish`,
        "POST",
        {
          expectedRevision: revision,
          expectedRecordVersion: recordVersion,
          expectedContentHash: contentHash,
          mediaApprovalHash,
          evidenceApprovalHash,
        },
      );
      showMessage(
        typeof payload.slug === "string"
          ? `Committed: ${payload.slug}. Waiting for deployment verification.`
          : "Committed. Waiting for deployment verification.",
      );
      startTransition(() => router.refresh());
    } catch (caught) {
      showMessage(caught instanceof Error ? caught.message : "Publish failed.");
      setConfirmStage(null);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    try {
      await callApi(
        `/api/news/draft/${encodeURIComponent(draft.id)}`,
        "DELETE",
        {
          expectedRevision: revision,
          expectedRecordVersion: recordVersion,
          expectedContentHash: contentHash,
        },
      );
      showMessage("Draft rejected and removed.");
      startTransition(() => router.refresh());
    } catch (caught) {
      showMessage(caught instanceof Error ? caught.message : "Reject failed.");
      setConfirmStage(null);
    } finally {
      setBusy(null);
    }
  }

  async function toggleSource(url: string, checked: boolean) {
    const next = checked
      ? [...new Set([...verifiedSources, url])]
      : verifiedSources.filter((item) => item !== url);
    setBusy(`source:${url}`);
    try {
      const payload = await callApi(
        `/api/news/draft/${encodeURIComponent(draft.id)}`,
        "PATCH",
        {
          expectedRevision: revision,
          expectedRecordVersion: recordVersion,
          expectedContentHash: contentHash,
          verifiedSources: next,
        },
      );
      const updated = payload.draft as NewsDraft | undefined;
      setVerifiedSources(updated?.verifiedSources ?? next);
      setEvidenceApprovalHash(updated?.evidenceApproval?.hash ?? "");
      if (updated) {
        setRevision(updated.revision);
        setRecordVersion(updated.recordVersion);
        setContentHash(updated.contentHash);
        setMediaApproval(updated.mediaApproval);
      }
      showMessage(
        updated?.evidenceApproval
          ? "Evidence approval bound to this exact revision."
          : "Source check saved; every cited source and fetched record is required.",
      );
    } catch (caught) {
      showMessage(
        caught instanceof Error ? caught.message : "Source check failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function approveMedia() {
    setBusy("media");
    try {
      const payload = await callApi(
        `/api/news/draft/${encodeURIComponent(draft.id)}/media-approval`,
        "POST",
        {
          expectedRevision: revision,
          expectedRecordVersion: recordVersion,
          expectedContentHash: contentHash,
          ...mediaRecord,
        },
      );
      const approved = payload.mediaApproval as
        | NewsDraft["mediaApproval"]
        | undefined;
      if (!approved) {
        throw new Error("The media approval ledger was not returned.");
      }
      setMediaApproval(approved);
      if (typeof payload.revision === "number") {
        setRevision(payload.revision);
      }
      if (typeof payload.recordVersion === "number") {
        setRecordVersion(payload.recordVersion);
      }
      if (typeof payload.contentHash === "string") {
        setContentHash(payload.contentHash);
      }
      showMessage("Real UHD cover bytes and rights record approved.");
    } catch (caught) {
      showMessage(
        caught instanceof Error ? caught.message : "Media approval failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className={styles.draft}>
      <header className={styles.draftHeader}>
        <div className={styles.score}>
          <span>Gate score</span>
          <strong>{confidence}</strong>
          <i aria-hidden="true">
            <b style={{ width: `${confidence}%` }} />
          </i>
        </div>
        <div className={styles.draftTitle}>
          <div className={styles.tags}>
            <span>{draft.article.category}</span>
            <span>Source score {draft.provenance.score}</span>
            {unbackedCount > 0 ? (
              <span className={styles.warning}>
                {unbackedCount} figure{unbackedCount === 1 ? "" : "s"} to check
              </span>
            ) : null}
          </div>
          <h2>{draft.article.title}</h2>
          <p>{draft.article.subtitle}</p>
        </div>
      </header>

      <div className={styles.gates}>
        <div aria-label="Validator gates">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((gate) => {
            const state = blockedGates.has(gate)
              ? "fail"
              : warningGates.has(gate)
                ? "warn"
                : "pass";
            return (
              <span
                key={gate}
                className={styles[state]}
                title={`Gate ${gate}: ${GATE_NAMES[gate]} — ${state}`}
              >
                {gate}
              </span>
            );
          })}
        </div>
        <dl>
          <Metric value={validator.metrics.wordCount} label="Words" />
          <Metric
            value={validator.metrics.headlineLength}
            label="Headline characters"
          />
          <Metric
            value={`${validator.metrics.citationsFromWhitelist}/${validator.metrics.citationCount}`}
            label="Allowed citations"
          />
          <Metric
            value={validator.metrics.p1HasNumber ? "Yes" : "No"}
            label="Opening evidence"
          />
        </dl>
      </div>

      <nav className={styles.tabs} aria-label="Draft review views">
        {(["verify", "preview", "edit"] as View[]).map((tab) => (
          <button
            type="button"
            key={tab}
            aria-pressed={view === tab}
            onClick={() => setView(tab)}
          >
            {tab === "verify" ? "Verify evidence" : tab}
          </button>
        ))}
      </nav>

      <div className={styles.reviewBody}>
        {view === "verify" ? (
          <VerifyView
            draft={draft}
            activeSource={activeSource}
            setActiveSource={setActiveSource}
            verifiedSources={verifiedSources}
            toggleSource={toggleSource}
            busy={busy}
          />
        ) : null}
        {view === "preview" ? (
          <div className={styles.preview}>
            <SemaformLayout
              article={{ ...draft.article, status: "live" } as NewsArticle}
            />
          </div>
        ) : null}
        {view === "edit" ? (
          <EditView
            edit={edit}
            setEdit={setEdit}
            save={saveEdit}
            busy={busy === "save"}
          />
        ) : null}
      </div>

      <section className={styles.mediaPanel} aria-label="UHD media approval">
        <div>
          <span>Immutable media gate</span>
          <h3>Inspect the real article cover</h3>
          <p>
            The Desk reads the cover bytes from the publication branch,
            fully decodes the image and requires genuine 3840 × 2160 detail
            before binding its hash and rights record to this revision.
          </p>
        </div>
        {mediaApproval ? (
          <dl>
            <div>
              <dt>Approved size</dt>
              <dd>
                {mediaApproval.width} × {mediaApproval.height}
              </dd>
            </div>
            <div>
              <dt>Repository file</dt>
              <dd>{mediaApproval.repoPath}</dd>
            </div>
            <div>
              <dt>Credit</dt>
              <dd>{mediaApproval.credit}</dd>
            </div>
            <div>
              <dt>Byte proof</dt>
              <dd>{mediaApproval.contentSha256.slice(0, 16)}…</dd>
            </div>
          </dl>
        ) : (
          <div className={styles.mediaForm}>
            <label>
              Official source URL
              <input
                type="url"
                value={mediaRecord.sourceUrl}
                onChange={(event) =>
                  setMediaRecord({
                    ...mediaRecord,
                    sourceUrl: event.target.value,
                  })
                }
                placeholder="https://official-source.example/asset"
              />
            </label>
            <label>
              Rights basis
              <input
                value={mediaRecord.rightsStatus}
                onChange={(event) =>
                  setMediaRecord({
                    ...mediaRecord,
                    rightsStatus: event.target.value,
                  })
                }
                placeholder="Owned or licensed editorial use"
              />
            </label>
            <label>
              Visible credit
              <input
                value={mediaRecord.credit}
                onChange={(event) =>
                  setMediaRecord({
                    ...mediaRecord,
                    credit: event.target.value,
                  })
                }
                placeholder="Developer / photographer"
              />
            </label>
            <Button
              tone="quiet"
              busy={busy === "media"}
              disabled={
                !mediaRecord.sourceUrl.trim() ||
                mediaRecord.rightsStatus.trim().length < 8 ||
                mediaRecord.credit.trim().length < 2
              }
              onClick={approveMedia}
            >
              {busy === "media"
                ? "Inspecting UHD bytes…"
                : "Inspect and approve UHD cover"}
            </Button>
          </div>
        )}
      </section>

      <footer className={styles.actions}>
        <p className={styles.humanGate}>
          Figures: {figuresVerified
            ? "verified against fetched evidence"
            : `${unbackedCount} require human confirmation`}
          {" · "}
          Evidence: {allSourcesVerified && evidenceApprovalHash
            ? "approved for this revision"
            : "source-by-source review incomplete"}
          {" · "}
          Media: {mediaApprovalHash
            ? "approved byte ledger attached"
            : "UHD rights/byte approval required"}
        </p>

        <div className={styles.actionRow}>
          {confirmStage === "publish" ? (
            <div className={styles.confirm}>
              <strong>Publish this reviewed draft?</strong>
              <Button tone="positive" busy={busy === "publish"} onClick={publish}>
                {busy === "publish" ? "Publishing…" : "Confirm publication"}
              </Button>
              <Button tone="quiet" onClick={() => setConfirmStage(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              tone="primary"
              disabled={!canPublish}
              onClick={() => setConfirmStage("publish")}
              title={
                !validator.ok
                  ? "All blocking validator gates must pass."
                  : unbackedCount > 0
                    ? "Every material figure must appear in fetched evidence."
                    : !allSourcesVerified || !evidenceApprovalHash
                      ? "Complete the source-by-source evidence check."
                      : !mediaApprovalHash
                        ? "Attach an approved UHD media ledger."
                    : undefined
              }
            >
              Approve and publish
            </Button>
          )}

          {confirmStage === "reject" ? (
            <div className={styles.confirm}>
              <strong>Reject and remove this draft?</strong>
              <Button tone="danger" busy={busy === "reject"} onClick={reject}>
                {busy === "reject" ? "Rejecting…" : "Confirm rejection"}
              </Button>
              <Button tone="quiet" onClick={() => setConfirmStage(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button tone="quiet" onClick={() => setConfirmStage("reject")}>
              Reject
            </Button>
          )}

          <DistributionState distribution={draft.article.distribution} />
        </div>

        {!validator.ok ? (
          <p className={styles.blocked} role="status">
            Publishing blocked:{" "}
            {validator.failures
              .filter((failure) => failure.severity === "block")
              .map((failure) => failure.name)
              .join(" · ")}
          </p>
        ) : null}
      </footer>

      {message ? (
        <div className={styles.message} role="status" aria-live="polite">
          {message}
        </div>
      ) : null}
    </article>
  );
}

function Metric({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function VerifyView({
  draft,
  activeSource,
  setActiveSource,
  verifiedSources,
  toggleSource,
  busy,
}: {
  draft: NewsDraft;
  activeSource: string | null;
  setActiveSource: (url: string | null) => void;
  verifiedSources: string[];
  toggleSource: (url: string, checked: boolean) => void;
  busy: string | null;
}) {
  const evidence = draft.provenance.fetchedEvidence ?? [];
  const citations = draft.article.citations;
  const sources = citations.map((citation) => {
    const record = evidence.find((item) => item.url === citation.url);
    return {
      name: citation.source,
      tier: record ? "Fetched evidence" : "Evidence unavailable",
      url: citation.url,
      summary: record?.text ?? "No independently fetched text is attached.",
    };
  });
  return (
    <div className={styles.verify}>
      <div className={styles.copy}>
        <p className={styles.viewLabel}>Draft copy · figures highlighted</p>
        {draft.article.body.split(/\n\n+/).map((paragraph, index) => (
          <p key={index}>
            {highlightFigures(
              paragraph,
              evidence,
              setActiveSource,
            )}
          </p>
        ))}
      </div>
      <aside className={styles.sources}>
        <p className={styles.viewLabel}>
          {citations.length} cited source{citations.length === 1 ? "" : "s"}
        </p>
        {citations.length === 0 ? (
          <div className={styles.noSources}>
            No source cluster is attached. Do not approve material claims.
          </div>
        ) : null}
        {sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            data-active={activeSource === source.url}
            onMouseEnter={() => setActiveSource(source.url)}
            onMouseLeave={() => setActiveSource(null)}
            onFocus={() => setActiveSource(source.url)}
            onBlur={() => setActiveSource(null)}
          >
            <span>
              <strong>{source.name}</strong>
              <small>{source.tier}</small>
            </span>
            <p>
              {source.summary.slice(0, 240)}
              {source.summary.length > 240 ? "…" : ""}
            </p>
          </a>
        ))}
        <div className={styles.sourceChecks}>
          {citations.map((citation) => {
            const hasEvidence = evidence.some(
              (item) => item.url === citation.url,
            );
            return (
              <label key={`check-${citation.url}`}>
                <input
                  type="checkbox"
                  checked={verifiedSources.includes(citation.url)}
                  disabled={!hasEvidence || busy !== null}
                  onChange={(event) =>
                    toggleSource(citation.url, event.target.checked)
                  }
                />
                <span>{citation.source}</span>
                <small>
                  {hasEvidence
                    ? "Checked against exact source"
                    : "Fetched evidence required"}
                </small>
              </label>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function highlightFigures(
  text: string,
  evidence: NonNullable<NewsDraft["provenance"]["fetchedEvidence"]>,
  setActiveSource: (url: string | null) => void,
) {
  const output: React.ReactNode[] = [];
  const matcher = new RegExp(NUMBER_RE.source, "gi");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = matcher.exec(text)) !== null) {
    const figure = match[0];
    if (match.index > lastIndex) {
      output.push(text.slice(lastIndex, match.index));
    }
    const core = digitsOf(figure);
    const source = evidence.find((item) =>
      digitsOf(item.text).includes(core),
    );
    const backed = core.length < 2 || Boolean(source);

    output.push(
      <mark
        key={`figure-${key++}`}
        data-backed={backed}
        onMouseEnter={() => source && setActiveSource(source.url)}
        onMouseLeave={() => setActiveSource(null)}
        title={
          backed
            ? "Present in the attached source record"
            : "Not found in the attached source record"
        }
      >
        {figure}
      </mark>,
    );
    lastIndex = match.index + figure.length;
  }

  if (lastIndex < text.length) output.push(text.slice(lastIndex));
  return output;
}

function EditView({
  edit,
  setEdit,
  save,
  busy,
}: {
  edit: { title: string; subtitle: string; body: string };
  setEdit: (value: { title: string; subtitle: string; body: string }) => void;
  save: () => void;
  busy: boolean;
}) {
  return (
    <div className={styles.edit}>
      <label>
        Headline
        <input
          value={edit.title}
          onChange={(event) => setEdit({ ...edit, title: event.target.value })}
        />
      </label>
      <label>
        Subtitle
        <input
          value={edit.subtitle}
          onChange={(event) =>
            setEdit({ ...edit, subtitle: event.target.value })
          }
        />
      </label>
      <label>
        Body
        <textarea
          value={edit.body}
          onChange={(event) => setEdit({ ...edit, body: event.target.value })}
        />
      </label>
      <Button tone="primary" busy={busy} onClick={save}>
        {busy ? "Saving…" : "Save and re-validate"}
      </Button>
    </div>
  );
}

function DistributionState({
  distribution,
}: {
  distribution: NewsArticle["distribution"];
}) {
  const channels = [
    ["IndexNow", true],
    ["Telegram", Boolean(distribution?.telegram)],
    ["LinkedIn", Boolean(distribution?.postiz?.linkedin)],
  ] as const;
  return (
    <span className={styles.distribution}>
      {channels.map(([label, active]) => (
        <span key={label} data-active={active}>
          {label}: {active ? "configured" : "off"}
        </span>
      ))}
    </span>
  );
}

function Button({
  children,
  onClick,
  tone,
  disabled,
  busy,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone: "primary" | "positive" | "danger" | "quiet";
  disabled?: boolean;
  busy?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles[tone]}`}
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
    >
      {children}
    </button>
  );
}
