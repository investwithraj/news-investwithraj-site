"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DldDailyPulse } from "@/lib/dld/types";
import type { FxSnapshot } from "@/lib/fx/rates";
import { CURRENCY_META, type Currency } from "@/lib/fx/rates";
import { useFx } from "@/components/ticker/FxProvider";
import { formatAed } from "@/lib/dld/types";
import { CONTACT, rootCtaUrl } from "@/lib/constants";
import styles from "./TerminalShell.module.css";

type PaneKey =
  | "pulse"
  | "fx"
  | "tape"
  | "headlines"
  | "closing"
  | "desk"
  | "areas";

const PANE_LABELS: Record<PaneKey, string> = {
  pulse: "DLD daily pulse",
  fx: "FX matrix",
  tape: "Market tape",
  headlines: "Top headlines",
  closing: "Closing Bell",
  desk: "Desk shortcuts",
  areas: "Area guides",
};

const DEFAULT_LAYOUT: PaneKey[] = [
  "pulse",
  "fx",
  "tape",
  "headlines",
  "closing",
  "desk",
  "areas",
];

const LAYOUT_KEY = "iwr-intelligence-terminal-layout-v2";

type Report = {
  slug: string;
  title: string;
  category: string;
  displayDate: string;
  publishedAt: string;
  modifiedAt: string;
  markets: string[];
  sourceCount: number;
  sourceLabels: string[];
};

interface Props {
  reports: Report[];
  areas: Array<{
    slug: string;
    name: string;
    emirate: string;
    modifiedAt: string;
  }>;
  bells: Array<{
    slug: string;
    title: string;
    displayDate: string;
    highlights: string[];
  }>;
}

type FeedState<T> =
  | { status: "loading"; data: null; message: string }
  | { status: "ready"; data: T; message: string }
  | { status: "error"; data: null; message: string };

export function TerminalShell({ reports, areas, bells }: Props) {
  const [layout, setLayout] = useState<PaneKey[]>(DEFAULT_LAYOUT);
  const [pulse, setPulse] = useState<FeedState<DldDailyPulse>>({
    status: "loading",
    data: null,
    message: "Checking the official DLD feed.",
  });
  const [fx, setFx] = useState<FeedState<FxSnapshot>>({
    status: "loading",
    data: null,
    message: "Checking the FX source.",
  });
  const { currency, setCurrency } = useFx();

  useEffect(() => {
    let savedLayout: PaneKey[] | null = null;
    try {
      const stored = localStorage.getItem(LAYOUT_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as PaneKey[];
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((pane) => pane in PANE_LABELS)
      ) {
        savedLayout = [...new Set(parsed)];
      }
    } catch {
      // Preferences are optional. A corrupt or blocked store uses defaults.
    }
    if (!savedLayout) return;
    const frame = window.requestAnimationFrame(() => {
      setLayout(savedLayout);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeeds() {
      const [pulseResult, fxResult] = await Promise.allSettled([
        fetch("/api/dld-pulse", {
          signal: controller.signal,
          cache: "no-store",
        }).then(async (response) => {
          if (!response.ok) throw new Error(`DLD request ${response.status}`);
          const data = (await response.json()) as unknown;
          if (!isDldPulse(data)) throw new Error("Invalid DLD payload");
          return data;
        }),
        fetch("/api/fx", {
          signal: controller.signal,
          cache: "no-store",
        }).then(async (response) => {
          if (!response.ok) throw new Error(`FX request ${response.status}`);
          const data = (await response.json()) as unknown;
          if (!isFxSnapshot(data)) throw new Error("Invalid FX payload");
          return data;
        }),
      ]);

      if (!controller.signal.aborted) {
        setPulse(
          pulseResult.status === "fulfilled"
            ? {
                status: "ready",
                data: pulseResult.value,
                message:
                  pulseResult.value.source === "live"
                    ? "Official Dubai Pulse open-data aggregate."
                    : "Cited official reference print; not a current live feed.",
              }
            : {
                status: "error",
                data: null,
                message:
                  "DLD data is unavailable. No replacement figure is being shown.",
              },
        );
        setFx(
          fxResult.status === "fulfilled"
            ? {
                status: "ready",
                data: fxResult.value,
                message:
                  fxResult.value.source === "live"
                    ? "Current upstream FX snapshot."
                    : "Current FX is unavailable; bundled fallback values are withheld.",
              }
            : {
                status: "error",
                data: null,
                message:
                  "FX data is unavailable. No replacement rate is being shown.",
              },
        );
      }
    }

    void loadFeeds();
    const interval = window.setInterval(loadFeeds, 5 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  function persist(next: PaneKey[]) {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    } catch {
      // The terminal remains usable when browser storage is disabled.
    }
  }

  function movePane(key: PaneKey, direction: -1 | 1) {
    const index = layout.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layout.length) return;
    const next = [...layout];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  }

  function togglePane(key: PaneKey) {
    persist(
      layout.includes(key)
        ? layout.filter((pane) => pane !== key)
        : [...layout, key],
    );
  }

  const hiddenPanes = useMemo(
    () =>
      (Object.keys(PANE_LABELS) as PaneKey[]).filter(
        (pane) => !layout.includes(pane),
      ),
    [layout],
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.frame}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/">Daily Market Read</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">Terminal</span>
          </nav>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.kicker}>Power-user workspace</p>
              <h1>Market context, with its evidence visible.</h1>
            </div>
            <div className={styles.heroCopy}>
              <p>
                Arrange the desk around your decision. Data panes identify
                their source, represented period and fallback state. The
                market tape contains published reporting—not simulated trades.
              </p>
              <span>
                Preferences remain in this browser and can be reset at any
                time.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.workspace} aria-labelledby="workspace-heading">
        <div className={styles.frame}>
          <div className={styles.workspaceHead}>
            <div>
              <p className={styles.kicker}>Seven-pane desk</p>
              <h2 id="workspace-heading">Your working view</h2>
            </div>
            <button
              type="button"
              className={styles.reset}
              onClick={() => persist(DEFAULT_LAYOUT)}
            >
              Reset layout
            </button>
          </div>

          {hiddenPanes.length > 0 && (
            <div className={styles.hiddenBar}>
              <span>Hidden panes</span>
              {hiddenPanes.map((pane) => (
                <button
                  type="button"
                  key={pane}
                  onClick={() => togglePane(pane)}
                >
                  Add {PANE_LABELS[pane]}
                </button>
              ))}
            </div>
          )}

          {layout.length === 0 ? (
            <div className={styles.emptyDesk}>
              <h2>The workspace is clear.</h2>
              <p>Add a pane above or restore the complete desk.</p>
              <button type="button" onClick={() => persist(DEFAULT_LAYOUT)}>
                Restore all panes
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {layout.map((pane) => (
                <Pane
                  key={pane}
                  pane={pane}
                  onEarlier={() => movePane(pane, -1)}
                  onLater={() => movePane(pane, 1)}
                  onHide={() => togglePane(pane)}
                >
                  {pane === "pulse" && <PulsePane state={pulse} />}
                  {pane === "fx" && (
                    <FxPane
                      state={fx}
                      active={currency}
                      onPick={setCurrency}
                    />
                  )}
                  {pane === "tape" && <TapePane reports={reports} />}
                  {pane === "headlines" && (
                    <HeadlinesPane reports={reports} />
                  )}
                  {pane === "closing" && <ClosingPane bells={bells} />}
                  {pane === "desk" && <DeskPane />}
                  {pane === "areas" && <AreasPane areas={areas} />}
                </Pane>
              ))}
            </div>
          )}

          <div className={styles.preferencesNote}>
            <strong>Saved layout / preferences</strong>
            <p>
              Pane order and visibility are stored only in this browser. No
              account profile is created, and Reset layout restores the
              publication default.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.method} aria-labelledby="terminal-method">
        <div className={`${styles.frame} ${styles.methodGrid}`}>
          <div>
            <p className={styles.kicker}>Reading the terminal</p>
            <h2 id="terminal-method">Reference first. Interpretation second.</h2>
          </div>
          <div className={styles.methodCopy}>
            <p>
              “Live” appears only when the official upstream reports a fresh
              payload. Reference and unavailable states stay visible rather
              than being filled with generated figures.
            </p>
            <p>
              This workspace is editorial context, not a land-registry extract,
              valuation, investment recommendation or substitute for current
              due diligence.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Pane({
  pane,
  children,
  onEarlier,
  onLater,
  onHide,
}: {
  pane: PaneKey;
  children: React.ReactNode;
  onEarlier: () => void;
  onLater: () => void;
  onHide: () => void;
}) {
  return (
    <section className={styles.pane}>
      <header className={styles.paneHead}>
        <h3>{PANE_LABELS[pane]}</h3>
        <div>
          <button
            type="button"
            onClick={onEarlier}
            aria-label={`Move ${PANE_LABELS[pane]} earlier`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onLater}
            aria-label={`Move ${PANE_LABELS[pane]} later`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onHide}
            aria-label={`Hide ${PANE_LABELS[pane]}`}
          >
            ×
          </button>
        </div>
      </header>
      <div className={styles.paneBody}>{children}</div>
    </section>
  );
}

function FeedNotice({
  tone,
  children,
}: {
  tone: "neutral" | "reference" | "live" | "error";
  children: React.ReactNode;
}) {
  return <p className={`${styles.notice} ${styles[tone]}`}>{children}</p>;
}

function PulsePane({ state }: { state: FeedState<DldDailyPulse> }) {
  if (state.status === "loading") {
    return <FeedNotice tone="neutral">{state.message}</FeedNotice>;
  }
  if (state.status === "error") {
    return <FeedNotice tone="error">{state.message}</FeedNotice>;
  }

  const pulse = state.data;
  return (
    <div className={styles.dataStack}>
      <FeedNotice tone={pulse.source === "live" ? "live" : "reference"}>
        {state.message}
      </FeedNotice>
      <dl className={styles.metrics}>
        <Metric
          label="Represented period"
          value={pulse.periodLabel ?? pulse.date}
        />
        <Metric label="Transactions" value={pulse.txnCount.toLocaleString()} />
        <Metric
          label="Volume"
          value={`AED ${formatAed(pulse.volumeAed)}`}
        />
        <Metric
          label="Average"
          value={`AED ${formatAed(pulse.avgPriceAed)}`}
        />
        {typeof pulse.medianPpsfAed === "number" && (
          <Metric
            label="Median price / sq ft"
            value={`AED ${pulse.medianPpsfAed.toLocaleString()}`}
          />
        )}
      </dl>
      <p className={styles.sourceLine}>
        Source: {pulse.sourceNote ?? "DLD source not labelled"} · checked{" "}
        <time dateTime={pulse.fetchedAt}>
          {formatTimestamp(pulse.fetchedAt)}
        </time>
      </p>
    </div>
  );
}

function FxPane({
  state,
  active,
  onPick,
}: {
  state: FeedState<FxSnapshot>;
  active: Currency;
  onPick: (currency: Currency) => void;
}) {
  if (state.status === "loading") {
    return <FeedNotice tone="neutral">{state.message}</FeedNotice>;
  }
  if (state.status === "error") {
    return <FeedNotice tone="error">{state.message}</FeedNotice>;
  }
  if (state.data.source !== "live") {
    return (
      <div className={styles.dataStack}>
        <FeedNotice tone="reference">{state.message}</FeedNotice>
        <p className={styles.explainer}>
          Rates remain blank until the configured upstream supplies a current
          snapshot. Use your bank or regulated FX provider for an executable
          rate.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.dataStack}>
      <FeedNotice tone="live">{state.message}</FeedNotice>
      <div className={styles.fxList}>
        {(Object.keys(CURRENCY_META) as Currency[]).map((currency) => (
          <button
            type="button"
            key={currency}
            onClick={() => onPick(currency)}
            aria-pressed={currency === active}
          >
            <span>
              {currency} · {CURRENCY_META[currency].label}
            </span>
            <b>{state.data.rates[currency]?.toFixed(4) ?? "—"}</b>
          </button>
        ))}
      </div>
      <p className={styles.sourceLine}>
        AED base · checked{" "}
        <time dateTime={state.data.fetchedAt}>
          {formatTimestamp(state.data.fetchedAt)}
        </time>
      </p>
    </div>
  );
}

function TapePane({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return (
      <FeedNotice tone="neutral">
        No reviewed reports are available for the publication tape.
      </FeedNotice>
    );
  }

  return (
    <div className={styles.dataStack}>
      <FeedNotice tone="reference">
        Editorial publication chronology—not a transaction feed.
      </FeedNotice>
      <ol className={styles.tape}>
        {reports.slice(0, 7).map((report) => (
          <li key={report.slug}>
            <time dateTime={report.publishedAt}>
              {formatTapeTime(report.publishedAt)}
            </time>
            <Link href={`/news/${report.slug}`}>{report.title}</Link>
            <span>
              {report.sourceCount} cited{" "}
              {report.sourceCount === 1 ? "source" : "sources"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HeadlinesPane({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return (
      <FeedNotice tone="neutral">
        No reviewed headlines are currently published.
      </FeedNotice>
    );
  }

  return (
    <ol className={styles.headlines}>
      {reports.slice(0, 6).map((report, index) => (
        <li key={report.slug}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p>
              {report.category.replaceAll("-", " ")} · {report.displayDate}
            </p>
            <Link href={`/news/${report.slug}`}>{report.title}</Link>
            <small>
              {report.sourceLabels.length > 0
                ? report.sourceLabels.join(" · ")
                : "Source list available in report"}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ClosingPane({ bells }: { bells: Props["bells"] }) {
  if (bells.length === 0) {
    return (
      <div className={styles.dataStack}>
        <FeedNotice tone="neutral">
          No Closing Bell edition has passed editorial review.
        </FeedNotice>
        <p className={styles.explainer}>
          The pane stays empty until a dated edition is published. There is no
          automated or simulated close.
        </p>
        <Link className={styles.textLink} href="/closing-bell">
          Open Closing Bell method
        </Link>
      </div>
    );
  }

  return (
    <ol className={styles.headlines}>
      {bells.map((bell, index) => (
        <li key={bell.slug}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p>{bell.displayDate}</p>
            <Link href={`/closing-bell/${bell.slug}`}>{bell.title}</Link>
            {bell.highlights[0] && <small>{bell.highlights[0]}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function DeskPane() {
  return (
    <div className={styles.desk}>
      <p>
        Move from reporting to a human decision review with Raj. Bring the
        asset, budget, timing and the assumption you most want tested.
      </p>
      <div className={styles.shortcutList}>
        <Link href="/ask">Ask the automated desk</Link>
        <Link href="/map">Open the area atlas</Link>
        <Link href="/developers">Review developers</Link>
        <a
          href={rootCtaUrl({
            campaign: "intelligence-terminal",
            content: "book-raj",
          })}
        >
          Book a call with Raj ↗
        </a>
      </div>
      <a className={styles.email} href={`mailto:${CONTACT.email}`}>
        {CONTACT.email}
      </a>
    </div>
  );
}

function AreasPane({ areas }: { areas: Props["areas"] }) {
  return (
    <div className={styles.areaList}>
      {areas.slice(0, 12).map((area) => (
        <Link key={area.slug} href={`/areas/${area.slug}`}>
          <span>{area.name}</span>
          <small>{area.emirate}</small>
        </Link>
      ))}
      <Link className={styles.textLink} href="/areas">
        View all area guides
      </Link>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function isDldPulse(value: unknown): value is DldDailyPulse {
  if (!value || typeof value !== "object") return false;
  const pulse = value as Partial<DldDailyPulse>;
  return (
    (pulse.source === "live" || pulse.source === "reference") &&
    typeof pulse.date === "string" &&
    typeof pulse.fetchedAt === "string" &&
    typeof pulse.txnCount === "number" &&
    Number.isFinite(pulse.txnCount) &&
    pulse.txnCount >= 0 &&
    typeof pulse.volumeAed === "number" &&
    Number.isFinite(pulse.volumeAed) &&
    pulse.volumeAed >= 0 &&
    typeof pulse.avgPriceAed === "number" &&
    Number.isFinite(pulse.avgPriceAed) &&
    pulse.avgPriceAed >= 0
  );
}

function isFxSnapshot(value: unknown): value is FxSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<FxSnapshot>;
  return (
    (snapshot.source === "live" || snapshot.source === "fallback") &&
    typeof snapshot.fetchedAt === "string" &&
    Boolean(snapshot.rates) &&
    typeof snapshot.rates === "object" &&
    Object.values(snapshot.rates).every(
      (rate) => typeof rate === "number" && Number.isFinite(rate) && rate > 0,
    )
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "timestamp unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  }).format(date);
}

function formatTapeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dubai",
  }).format(date);
}
