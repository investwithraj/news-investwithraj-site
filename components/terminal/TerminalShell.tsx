"use client";

// F3 — Beyond the Deal Terminal.
// Bloomberg-Terminal-for-Dubai-RE. Multi-pane workspace — drag panes to
// reorder, toggle visibility, layout persists in localStorage. Day-1
// panes: DLD Pulse · FX · Markets Tape · Headlines · Closing Bell · The Desk.
//
// Live data feeds via /api/dld-pulse + /api/fx — same endpoints powering
// the public ticker. Heavier panes (Globe, Skyline mini, Heatmap) can plug
// in as separate panes when Wave 10/9 components are paneable.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DldDailyPulse } from "@/lib/dld/types";
import type { FxSnapshot } from "@/lib/fx/rates";
import { CURRENCY_META, type Currency } from "@/lib/fx/rates";
import { useFx } from "@/components/ticker/FxProvider";
import { formatAed } from "@/lib/dld/types";

type PaneKey =
  | "pulse"
  | "fx"
  | "tape"
  | "headlines"
  | "closing"
  | "desk"
  | "areas-tape";

const PANE_LABELS: Record<PaneKey, string> = {
  pulse: "DLD Pulse",
  fx: "FX Matrix",
  tape: "Markets Tape",
  headlines: "Headlines",
  closing: "Closing Bell",
  desk: "The Desk",
  "areas-tape": "Areas Tape",
};

const DEFAULT_LAYOUT: PaneKey[] = [
  "pulse",
  "fx",
  "headlines",
  "tape",
  "areas-tape",
  "closing",
  "desk",
];

const LAYOUT_KEY = "iwr-terminal-layout";

interface Props {
  headlines: Array<{
    slug: string;
    title: string;
    category: string;
    displayDate: string;
  }>;
  areas: Array<{ slug: string; name: string; emirate: string; medianPsf?: number }>;
  bells: Array<{ slug: string; title: string; displayDate: string; highlights: string[] }>;
}

export function TerminalShell({ headlines, areas, bells }: Props) {
  const [layout, setLayout] = useState<PaneKey[]>(DEFAULT_LAYOUT);
  const [pulse, setPulse] = useState<DldDailyPulse | null>(null);
  const [fxSnap, setFxSnap] = useState<FxSnapshot | null>(null);
  const { currency, setCurrency } = useFx();

  // Persisted layout
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PaneKey[];
        if (Array.isArray(parsed) && parsed.every((p) => p in PANE_LABELS)) {
          setLayout(parsed);
        }
      }
    } catch {}
  }, []);

  // Live data
  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      try {
        const [p, f] = await Promise.all([
          fetch("/api/dld-pulse").then((r) => r.json() as Promise<DldDailyPulse>),
          fetch("/api/fx").then((r) => r.json() as Promise<FxSnapshot>),
        ]);
        if (mounted) {
          setPulse(p);
          setFxSnap(f);
        }
      } catch {}
    }
    fetchAll();
    const t = setInterval(fetchAll, 5 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  function movePane(key: PaneKey, dir: -1 | 1) {
    setLayout((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function togglePane(key: PaneKey) {
    setLayout((prev) => {
      const next = prev.includes(key)
        ? prev.filter((p) => p !== key)
        : [...prev, key];
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(DEFAULT_LAYOUT));
    } catch {}
  }

  const hiddenPanes = useMemo(
    () => (Object.keys(PANE_LABELS) as PaneKey[]).filter((k) => !layout.includes(k)),
    [layout]
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#05081A", color: "var(--paper)" }}>
      {/* Header bar */}
      <header
        className="px-5 md:px-8 py-3 border-b flex flex-wrap items-center gap-4 justify-between text-xs font-mono uppercase tracking-[0.15em]"
        style={{ borderColor: "rgba(201, 169, 97, 0.18)" }}
      >
        <div className="flex items-center gap-4">
          <Link href="/" data-magnetic style={{ color: "var(--gold-bright, #E0C076)" }}>
            ← desk
          </Link>
          <span style={{ color: "rgba(248, 250, 252, 0.45)" }}>terminal · v1</span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: pulse?.source === "live" ? "#22c55e" : "#E0C076", animation: "pulse 1.6s infinite" }} />
            {pulse?.source === "live" ? "live" : pulse ? "mock" : "loading"}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="bg-transparent border-b text-xs uppercase tracking-[0.15em] outline-none cursor-pointer"
            style={{ color: "var(--paper)", borderColor: "rgba(201,169,97,0.3)" }}
          >
            {Object.values(CURRENCY_META).map((c) => (
              <option key={c.code} value={c.code} className="text-black">
                {c.code}
              </option>
            ))}
          </select>
          <button
            onClick={resetLayout}
            className="px-2 py-1 border hover:bg-white/5"
            style={{ borderColor: "rgba(201,169,97,0.3)" }}
          >
            Reset layout
          </button>
        </div>
      </header>

      {/* Hidden panes drawer */}
      {hiddenPanes.length > 0 && (
        <div
          className="px-5 md:px-8 py-2 border-b flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] flex-wrap"
          style={{ borderColor: "rgba(201, 169, 97, 0.12)", background: "rgba(255,255,255,0.02)" }}
        >
          <span style={{ color: "rgba(248,250,252,0.45)" }}>hidden:</span>
          {hiddenPanes.map((k) => (
            <button
              key={k}
              onClick={() => togglePane(k)}
              className="px-2 py-1 border hover:bg-white/5"
              style={{ borderColor: "rgba(201,169,97,0.3)", color: "var(--gold-bright, #E0C076)" }}
            >
              + {PANE_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      {/* Panes grid — auto-flow, responsive */}
      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5 auto-rows-min">
        {layout.map((paneKey) => (
          <Pane
            key={paneKey}
            paneKey={paneKey}
            onMoveUp={() => movePane(paneKey, -1)}
            onMoveDown={() => movePane(paneKey, 1)}
            onClose={() => togglePane(paneKey)}
          >
            {paneKey === "pulse" && <PulsePane pulse={pulse} />}
            {paneKey === "fx" && <FxPane snap={fxSnap} active={currency} onPick={setCurrency} />}
            {paneKey === "tape" && <TapePane pulse={pulse} />}
            {paneKey === "headlines" && <HeadlinesPane headlines={headlines} />}
            {paneKey === "closing" && <ClosingPane bells={bells} />}
            {paneKey === "desk" && <DeskPane />}
            {paneKey === "areas-tape" && <AreasTapePane areas={areas} />}
          </Pane>
        ))}
      </main>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}

function Pane({
  paneKey,
  children,
  onMoveUp,
  onMoveDown,
  onClose,
}: {
  paneKey: PaneKey;
  children: React.ReactNode;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
}) {
  return (
    <section
      className="rounded-xl border flex flex-col"
      style={{
        borderColor: "rgba(201, 169, 97, 0.22)",
        background: "rgba(255, 255, 255, 0.025)",
        backdropFilter: "blur(6px)",
        minHeight: 240,
      }}
    >
      <header
        className="px-4 py-2 border-b flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em]"
        style={{ borderColor: "rgba(201, 169, 97, 0.16)", color: "var(--gold-bright, #E0C076)" }}
      >
        <span>{PANE_LABELS[paneKey]}</span>
        <span className="flex items-center gap-1.5">
          <button onClick={onMoveUp} className="hover:text-[var(--paper)]" aria-label="Move up">↑</button>
          <button onClick={onMoveDown} className="hover:text-[var(--paper)]" aria-label="Move down">↓</button>
          <button onClick={onClose} className="hover:text-[#E58E89]" aria-label="Close">×</button>
        </span>
      </header>
      <div className="p-4 md:p-5 flex-1">{children}</div>
    </section>
  );
}

function PulsePane({ pulse }: { pulse: DldDailyPulse | null }) {
  if (!pulse) return <SkeletonRows />;
  return (
    <div className="space-y-3 font-mono text-xs">
      <KV label="Date" value={pulse.date} />
      <KV label="Txn count" value={String(pulse.txnCount)} accent />
      <KV label="Volume AED" value={formatAed(pulse.volumeAed)} accent />
      <KV
        label="DoD volume"
        value={`${pulse.dodVolumeChangePct >= 0 ? "▲" : "▼"} ${Math.abs(pulse.dodVolumeChangePct).toFixed(1)}%`}
        color={pulse.dodVolumeChangePct >= 0 ? "#7ED99F" : "#E58E89"}
      />
      <KV label="Avg AED" value={formatAed(pulse.avgPriceAed)} />
      <KV label="Median PSF" value={`${pulse.medianPpsfAed.toFixed(0)} AED`} />
      <hr style={{ borderColor: "rgba(201, 169, 97, 0.18)", margin: "8px 0" }} />
      <KV label="Hottest" value={pulse.hottestArea.name} accent />
      <KV label="• Volume" value={formatAed(pulse.hottestArea.volumeAed)} />
      <KV label="Top dev" value={pulse.topDeveloper.name} accent />
      <KV label="• Txns" value={String(pulse.topDeveloper.txnCount)} />
    </div>
  );
}

function FxPane({
  snap,
  active,
  onPick,
}: {
  snap: FxSnapshot | null;
  active: Currency;
  onPick: (c: Currency) => void;
}) {
  if (!snap) return <SkeletonRows />;
  return (
    <div className="space-y-1.5 font-mono text-xs">
      {(Object.keys(CURRENCY_META) as Currency[]).map((c) => {
        const meta = CURRENCY_META[c];
        const rate = snap.rates[c];
        const isActive = c === active;
        return (
          <button
            key={c}
            onClick={() => onPick(c)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5"
            style={{
              color: isActive ? "var(--gold-bright, #E0C076)" : "var(--paper)",
              background: isActive ? "rgba(201,169,97,0.08)" : "transparent",
            }}
          >
            <span className="flex items-center gap-2">
              <span style={{ width: "2.4em" }}>{meta.code}</span>
              <span style={{ opacity: 0.5 }}>{meta.symbol}</span>
            </span>
            <span className="tabular-nums">{rate?.toFixed(4) ?? "—"}</span>
          </button>
        );
      })}
      <div className="text-[10px] uppercase tracking-[0.18em] mt-3" style={{ color: "rgba(248,250,252,0.45)" }}>
        {snap.source} · {new Date(snap.fetchedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

function TapePane({ pulse }: { pulse: DldDailyPulse | null }) {
  // Simulated trade tape — recent prints in mock form.
  const tape = useMemo(() => {
    if (!pulse) return [];
    const rows = 12;
    return Array.from({ length: rows }, (_, i) => ({
      time: new Date(Date.now() - i * 8 * 60 * 1000).toLocaleTimeString().slice(0, 5),
      area: ["Marina", "Downtown", "Palm Jumeirah", "JLT", "Business Bay", "Hudayriyat", "Saadiyat"][i % 7],
      price: Math.round(pulse.avgPriceAed * (0.6 + Math.random() * 0.9) / 1000) * 1000,
      side: i % 3 === 0 ? "BUY" : "SOLD",
    }));
  }, [pulse]);

  if (!pulse) return <SkeletonRows />;
  return (
    <div className="font-mono text-[11px] space-y-0.5 max-h-[240px] overflow-y-auto">
      {tape.map((t, i) => (
        <div key={i} className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/5">
          <span style={{ color: "rgba(248,250,252,0.5)" }}>{t.time}</span>
          <span className="flex-1 mx-3 truncate">{t.area}</span>
          <span style={{ color: t.side === "BUY" ? "#7ED99F" : "var(--gold-bright, #E0C076)" }}>
            {t.side}
          </span>
          <span className="ml-3 tabular-nums">{formatAed(t.price)}</span>
        </div>
      ))}
    </div>
  );
}

function HeadlinesPane({ headlines }: { headlines: Props["headlines"] }) {
  if (headlines.length === 0) {
    return (
      <p className="text-xs" style={{ color: "rgba(248,250,252,0.5)" }}>
        First headlines drop with the morning cron at 07:00 GST.
      </p>
    );
  }
  return (
    <ul className="space-y-3 text-xs">
      {headlines.slice(0, 8).map((h) => (
        <li key={h.slug}>
          <Link href={`/news/${h.slug}`} className="block hover:bg-white/5 rounded p-2 -mx-2" data-magnetic>
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(248,250,252,0.4)" }}>
              {h.category} · {h.displayDate}
            </div>
            <div style={{ color: "var(--paper)" }}>{h.title}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ClosingPane({ bells }: { bells: Props["bells"] }) {
  if (bells.length === 0) {
    return (
      <p className="text-xs" style={{ color: "rgba(248,250,252,0.5)" }}>
        First Closing Bell drops with the next business-day close at 16:30 GST.
      </p>
    );
  }
  return (
    <ul className="space-y-3 text-xs">
      {bells.slice(0, 3).map((b) => (
        <li key={b.slug}>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] mb-1" style={{ color: "var(--gold-bright, #E0C076)" }}>
            {b.displayDate} · 16:30 GST
          </div>
          <div style={{ color: "var(--paper)" }}>{b.title}</div>
          <ul className="mt-1 space-y-0.5" style={{ color: "rgba(248,250,252,0.6)" }}>
            {b.highlights.slice(0, 3).map((h, i) => (
              <li key={i}>· {h}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function AreasTapePane({ areas }: { areas: Props["areas"] }) {
  return (
    <div className="space-y-1.5 font-mono text-[11px]">
      {areas.slice(0, 12).map((a) => (
        <Link
          key={a.slug}
          href={`/areas/${a.slug}`}
          data-magnetic
          className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5"
        >
          <span className="flex-1 truncate" style={{ color: "var(--paper)" }}>
            {a.name}
          </span>
          <span style={{ color: "rgba(248,250,252,0.45)" }}>{a.emirate.slice(0, 3).toUpperCase()}</span>
          {a.medianPsf && (
            <span className="ml-3 tabular-nums" style={{ color: "var(--gold-bright, #E0C076)" }}>
              {a.medianPsf.toLocaleString()}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

function DeskPane() {
  return (
    <div className="space-y-3 text-xs leading-[1.55]" style={{ color: "var(--paper)" }}>
      <p className="italic" style={{ color: "rgba(248,250,252,0.85)" }}>
        “Numbers move; theses age. The desk's job is to tell you which one's
        which before lunch.”
      </p>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: "var(--gold-bright, #E0C076)" }}>
        — Raj · DLD-licensed broker · Dubai
      </p>
      <div className="pt-3 mt-3 border-t flex flex-wrap gap-2" style={{ borderColor: "rgba(201,169,97,0.18)" }}>
        <Link href="/ask" data-magnetic className="px-2 py-1 border text-[10px] uppercase tracking-[0.18em]" style={{ borderColor: "rgba(201,169,97,0.3)", color: "var(--gold-bright, #E0C076)" }}>
          Ask the desk →
        </Link>
        <Link href="/v/dld-pulse" data-magnetic className="px-2 py-1 border text-[10px] uppercase tracking-[0.18em]" style={{ borderColor: "rgba(201,169,97,0.3)", color: "var(--gold-bright, #E0C076)" }}>
          DLD Pulse →
        </Link>
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  accent,
  color,
}: {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "rgba(248,250,252,0.55)" }}>{label}</span>
      <span style={{ color: color || (accent ? "var(--gold-bright, #E0C076)" : "var(--paper)") }} className="tabular-nums">
        {value}
      </span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2 animate-pulse">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-3 rounded" style={{ background: "rgba(248, 250, 252, 0.05)" }} />
      ))}
    </div>
  );
}
