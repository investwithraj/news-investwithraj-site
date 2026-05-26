"use client";

// /ask client island — prompt + result panel for AI briefs.

import { useState } from "react";

const SAMPLE_PROMPTS = [
  "Should I buy a Palm Jebel Ali off-plan villa in 2026?",
  "What's the structural read on Hudayriyat Island?",
  "Compare Wynn Al Marjan rerating to Atlantis Royal on Palm Jumeirah",
  "Which Dubai community has the best yield in 2026?",
];

export function AskRajClient() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function ask(prompt: string) {
    setLoading(true);
    setError(null);
    setBrief(null);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: prompt }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        brief?: string;
        message?: string;
        error?: string;
        remaining?: number;
      };
      if (!res.ok || !data.ok) {
        setError(data.message || data.error || `HTTP ${res.status}`);
      } else {
        setBrief(data.brief || "");
        setRemaining(data.remaining ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    ask(topic.trim());
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <label
          className="block text-xs font-mono uppercase tracking-[0.22em]"
          style={{ color: "var(--gold-deep)" }}
        >
          Your topic
        </label>
        <div className="relative">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Is Saadiyat Island Reserve worth the premium over Yas Acres for a family villa play in 2026?"
            rows={3}
            maxLength={500}
            className="w-full rounded-2xl border p-5 text-base md:text-lg leading-[1.55] resize-none outline-none focus:border-[var(--gold-deep)]"
            style={{
              borderColor: "var(--gold-soft)",
              background: "var(--paper-pure, #FFFFFF)",
              color: "var(--ink)",
              fontFamily: "var(--font-fraunces), Georgia, serif",
            }}
          />
          <div className="absolute right-5 bottom-3 text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: "var(--ink-faint)" }}>
            {topic.length}/500
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <button
            type="submit"
            disabled={loading || !topic.trim()}
            data-magnetic
            className="btn-graphite group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{loading ? "Writing brief…" : "Generate brief"}</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </button>
          {remaining !== null && (
            <span className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: "var(--ink-faint)" }}>
              {remaining} briefs left this hour
            </span>
          )}
        </div>
      </form>

      {/* Sample prompts */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: "var(--ink-faint)" }}>
          Try one
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setTopic(p);
                ask(p);
              }}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-[var(--gold-soft)] disabled:opacity-50"
              style={{ borderColor: "var(--gold-soft)", color: "var(--ink-soft)" }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-2xl border p-5"
          style={{
            borderColor: "#E58E89",
            background: "rgba(229, 142, 137, 0.08)",
            color: "#a03a3a",
          }}
        >
          {error}
        </div>
      )}

      {/* Brief result */}
      {brief && (
        <article
          className="rounded-2xl border p-8 md:p-10"
          style={{ borderColor: "var(--gold-soft)", background: "var(--paper-pure, #FFFFFF)" }}
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-5" style={{ color: "var(--gold-deep)" }}>
            Generated · just now
          </div>
          <div
            className="prose max-w-none whitespace-pre-wrap text-base md:text-[17px] leading-[1.7]"
            style={{
              color: "var(--ink-soft)",
              fontFamily: "var(--font-fraunces), Georgia, serif",
            }}
          >
            {brief}
          </div>
          <div className="mt-8 pt-6 border-t flex flex-wrap items-center justify-between gap-4" style={{ borderColor: "var(--gold-soft)" }}>
            <span className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: "var(--ink-faint)" }}>
              Beyond the Deal · Generated Insight
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(brief);
              }}
              className="text-xs px-3 py-1.5 rounded-full border hover:bg-[var(--gold-soft)]"
              style={{ borderColor: "var(--gold-soft)", color: "var(--ink-soft)" }}
            >
              Copy
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
