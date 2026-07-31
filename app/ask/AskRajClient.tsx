"use client";

import { useState } from "react";
import styles from "./ask.module.css";

const SAMPLE_PROMPTS = [
  "What evidence should I compare before choosing a Dubai off-plan home?",
  "How should I read recent reporting on Saadiyat Island?",
  "What risks recur in UAE branded-residence reporting?",
  "What should a buyer verify before relying on a transaction headline?",
];

type BriefSource = {
  id: string;
  publisher: string;
  url: string;
  accessedAt: string;
  articleTitle: string;
  articleUrl: string;
};

type BriefResponse = {
  ok?: boolean;
  brief?: string;
  message?: string;
  error?: string;
  remaining?: number;
  resetAt?: number;
  generatedAt?: string;
  sources?: BriefSource[];
  sourceBoundary?: string;
};

export function AskRajClient() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [sources, setSources] = useState<BriefSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function ask(prompt: string) {
    setLoading(true);
    setError(null);
    setBrief(null);
    setSources([]);
    setGeneratedAt(null);
    setCopied(false);

    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: prompt }),
      });
      const data = (await response.json()) as BriefResponse;

      if (!response.ok || !data.ok || !data.brief) {
        setError(
          data.message ||
            data.error ||
            "The source-bounded brief is unavailable.",
        );
        return;
      }

      setBrief(data.brief);
      setSources(data.sources ?? []);
      setRemaining(data.remaining ?? null);
      setGeneratedAt(data.generatedAt ?? new Date().toISOString());
    } catch {
      setError(
        "The automated desk could not be reached. No replacement answer has been generated.",
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const prompt = topic.trim();
    if (prompt.length < 4) return;
    void ask(prompt);
  }

  return (
    <div className={styles.client}>
      <form
        onSubmit={onSubmit}
        className={styles.form}
        aria-busy={loading}
      >
        <div className={styles.labelRow}>
          <label htmlFor="ask-raj-topic">Your topic</label>
          <span id="ask-raj-topic-count">{topic.length}/500</span>
        </div>
        <textarea
          id="ask-raj-topic"
          value={topic}
          onChange={(event) => {
            setTopic(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Example: Compare the evidence I should review before choosing between a completed home and an off-plan purchase in Dubai."
          rows={6}
          minLength={4}
          maxLength={500}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error
              ? "ask-raj-topic-count ask-raj-disclosure ask-raj-error"
              : "ask-raj-topic-count ask-raj-disclosure"
          }
        />
        <div className={styles.formBase}>
          <p id="ask-raj-disclosure">
            AI-generated analysis · source-bounded · not financial, legal or
            property advice · five requests per hour per IP
          </p>
          <button type="submit" disabled={loading || topic.trim().length < 4}>
            <span>{loading ? "Checking sources…" : "Generate sourced brief"}</span>
            <span aria-hidden>→</span>
          </button>
        </div>
      </form>

      <div className={styles.suggestions}>
        <p>02 · Suggested prompts</p>
        <div>
          {SAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                setTopic(prompt);
                void ask(prompt);
              }}
              disabled={loading}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.srStatus} role="status" aria-live="polite">
        {loading
          ? "The automated desk is checking a source packet."
          : brief
            ? `The generated brief is ready.${remaining !== null ? ` ${remaining} requests remain in this hour.` : ""}`
            : ""}
      </p>

      {error && (
        <div id="ask-raj-error" role="alert" className={styles.error}>
          <div>
            <p>Automated brief not produced</p>
            <strong>{error}</strong>
          </div>
          <a href="mailto:office@investwithraj.com">Ask Raj’s office instead</a>
        </div>
      )}

      {brief && (
        <section className={styles.result} aria-labelledby="generated-brief">
          <header className={styles.resultHead}>
            <div>
              <p>03 · Generated brief</p>
              <h2 id="generated-brief">Automated analysis</h2>
            </div>
            <div>
              <span>AI-generated</span>
              {generatedAt && (
                <time dateTime={generatedAt}>{formatTime(generatedAt)}</time>
              )}
            </div>
          </header>

          <div className={styles.briefText}>{brief}</div>

          <div className={styles.resultBase}>
            <p>
              The citations below are the complete source boundary supplied to
              this response. Bracket references in the brief map to this list.
            </p>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(brief);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy brief"}
            </button>
          </div>

          <div className={styles.sources}>
            <div className={styles.sourcesHead}>
              <p>05 · Sources used</p>
              {remaining !== null && (
                <span>{remaining} requests remain this hour</span>
              )}
            </div>
            {sources.length > 0 ? (
              <ol>
                {sources.map((source) => (
                  <li key={`${source.id}-${source.url}`}>
                    <span>{source.id}</span>
                    <div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.publisher}
                        <i aria-hidden>↗</i>
                      </a>
                      <p>
                        Recorded for{" "}
                        <a href={source.articleUrl}>{source.articleTitle}</a>
                      </p>
                      <time dateTime={source.accessedAt}>
                        Accessed {formatDate(source.accessedAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.noSources}>
                No source list was returned; do not rely on this brief.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "time unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dubai",
  }).format(date);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
