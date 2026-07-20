"use client";

// Dashboard client — interactive queue cards with APPROVE/SKIP/EDIT/POSTPONE.
// Server component above this passes pre-sweeped queue data.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  QueueItem,
  QueueChannel,
  QueueAction,
  ChannelPolicy,
} from "@/lib/queue/types";

interface Stats {
  total: number;
  pending: number;
  approved: number;
  posted: number;
  skipped: number;
  expired: number;
  edited: number;
  byChannel: Record<QueueChannel, number>;
}

interface Props {
  pending: QueueItem[];
  urgent: QueueItem[];
  stats: Stats;
  recentActivity: QueueItem[];
  backend: "vercel-kv" | "file-system";
  channelPolicies: Record<QueueChannel, ChannelPolicy>;
}

const CHANNEL_CHIP_COLORS: Record<QueueChannel, string> = {
  reddit: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  quora: "bg-red-500/15 text-red-300 border-red-500/30",
  haro: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  qwoted: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  featured: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  stackexchange: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  biggerpockets: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  propertyhub: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  "discord-investor": "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  "linkedin-comment": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "twitter-reply": "bg-slate-500/15 text-slate-300 border-slate-500/30",
  "telegram-group": "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "expired";
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (h > 24) return `${Math.floor(h / 24)}d ago`;
  if (h === 0) return `${m}m ago`;
  return `${h}h ago`;
}

export function DashboardClient({
  pending,
  urgent,
  stats,
  recentActivity,
  backend,
  channelPolicies,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeChannel, setActiveChannel] = useState<QueueChannel | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editNote, setEditNote] = useState("");

  const visiblePending =
    activeChannel === "all" ? pending : pending.filter((i) => i.channel === activeChannel);

  async function callAction(
    id: string,
    action: QueueAction,
    extra: { draftText?: string; editNote?: string; postedUrl?: string } = {}
  ) {
    // Get the secret from URL or prompt
    const url = new URL(window.location.href);
    let secret = url.searchParams.get("secret") || sessionStorage.getItem("queue-secret") || "";
    if (!secret) {
      secret = window.prompt("Enter POST_PUBLISH_SECRET (one-time per session):") || "";
      if (!secret) return;
      sessionStorage.setItem("queue-secret", secret);
    }

    const res = await fetch(`/api/queue/action/${id}?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Action failed: ${data.error || res.statusText}`);
      sessionStorage.removeItem("queue-secret");
      return;
    }
    startTransition(() => router.refresh());
  }

  function startEdit(item: QueueItem) {
    setEditingId(item.id);
    setEditText(item.draftText);
    setEditNote(item.editNote || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
    setEditNote("");
  }

  async function saveEdit(id: string) {
    await callAction(id, "edit", { draftText: editText, editNote });
    cancelEdit();
  }

  function copyDraft(text: string) {
    navigator.clipboard.writeText(text).then(
      () => alert("Copied to clipboard"),
      () => alert("Copy failed")
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-[#F2EEE7]">
      {/* Header */}
      <header className="border-b border-[rgba(242,238,231,0.12)] bg-[#1A1A1B] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl tracking-tight">Outreach Queue</h1>
            <p className="text-xs text-[rgba(242,238,231,0.46)] mt-1">
              news.investwithraj.com · backend: <span className="font-mono">{backend}</span>
            </p>
          </div>
          <button
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
            className="text-sm px-4 py-2 rounded-md border border-[rgba(242,238,231,0.14)] hover:bg-[rgba(242,238,231,0.06)] disabled:opacity-50"
          >
            {isPending ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Stats strip */}
        <div className="max-w-7xl mx-auto px-6 pb-4 flex flex-wrap gap-3 text-xs">
          <StatChip label="pending" value={stats.pending} color="bg-[#C9A961]/15 text-[#C9A961]" />
          <StatChip label="urgent" value={urgent.length} color="bg-red-500/15 text-red-300" />
          <StatChip label="edited" value={stats.edited} color="bg-amber-500/15 text-amber-300" />
          <StatChip label="approved" value={stats.approved} color="bg-emerald-500/15 text-emerald-300" />
          <StatChip label="posted" value={stats.posted} color="bg-emerald-500/20 text-emerald-300" />
          <StatChip label="skipped" value={stats.skipped} color="bg-slate-500/15 text-slate-300" />
          <StatChip label="expired" value={stats.expired} color="bg-red-500/10 text-red-300" />
          <StatChip label="total" value={stats.total} color="bg-slate-500/20 text-slate-300" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        {/* Urgent banner */}
        {urgent.length > 0 && (
          <section className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-base text-red-300">
                {urgent.length} item{urgent.length === 1 ? "" : "s"} expiring within 4 hours
              </h2>
            </div>
            <div className="space-y-2 text-sm">
              {urgent.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <span className="text-red-300">
                    <span className="font-mono text-xs mr-2">{timeUntil(item.expiresAt)}</span>
                    <span className="opacity-70">{channelPolicies[item.channel].label}</span> ·{" "}
                    {item.target}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Channel tabs */}
        <section>
          <div className="flex flex-wrap gap-2 mb-6 text-xs">
            <ChannelTab
              label="All"
              count={pending.length}
              active={activeChannel === "all"}
              onClick={() => setActiveChannel("all")}
            />
            {(Object.keys(channelPolicies) as QueueChannel[]).map((c) => {
              const count = pending.filter((i) => i.channel === c).length;
              if (count === 0) return null;
              return (
                <ChannelTab
                  key={c}
                  label={channelPolicies[c].label}
                  count={count}
                  active={activeChannel === c}
                  onClick={() => setActiveChannel(c)}
                />
              );
            })}
          </div>

          {visiblePending.length === 0 ? (
            <div className="text-center py-16 text-[rgba(242,238,231,0.42)] text-sm">
              No pending items in this channel.
            </div>
          ) : (
            <div className="grid gap-4">
              {visiblePending.map((item) => {
                const policy = channelPolicies[item.channel];
                const isEditing = editingId === item.id;
                return (
                  <article
                    key={item.id}
                    className="bg-[#202021] border border-[rgba(242,238,231,0.12)] rounded-lg p-5 shadow-sm"
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border ${CHANNEL_CHIP_COLORS[item.channel]}`}
                        >
                          {policy.label}
                        </span>
                        <span className="text-xs text-[rgba(242,238,231,0.62)]">→ {item.target}</span>
                        {item.status === "edited" && (
                          <span className="text-[10px] uppercase font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
                            edited
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono text-[rgba(242,238,231,0.62)]">
                          {timeUntil(item.expiresAt)} left
                        </div>
                        <div className="text-[10px] text-[rgba(242,238,231,0.42)]">
                          created {timeAgo(item.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Rationale */}
                    <p className="text-xs text-[rgba(242,238,231,0.62)] italic mb-3">{item.rationale}</p>

                    {/* Policy note */}
                    <p className="text-[10px] text-[rgba(242,238,231,0.42)] mb-3 border-l-2 border-[#C9A961]/40 pl-2">
                      <span className="font-mono uppercase mr-1">policy:</span>
                      {policy.policyNote}
                    </p>

                    {/* Draft body */}
                    {isEditing ? (
                      <div className="space-y-3 mb-3">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={12}
                          className="w-full font-mono text-xs p-3 border border-[rgba(242,238,231,0.14)] rounded bg-[rgba(242,238,231,0.04)]"
                        />
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Edit note (optional)"
                          className="w-full text-xs p-2 border border-[rgba(242,238,231,0.14)] rounded"
                        />
                      </div>
                    ) : (
                      <pre className="text-xs font-mono whitespace-pre-wrap bg-[rgba(242,238,231,0.04)] p-3 rounded border border-[rgba(242,238,231,0.08)] mb-3 max-h-48 overflow-y-auto">
                        {item.draftText}
                      </pre>
                    )}

                    {item.sourceArticleSlug && (
                      <a
                        href={`/news/${item.sourceArticleSlug}`}
                        target="_blank"
                        rel="noopener"
                        className="text-xs text-[#B2924F] hover:underline mb-3 inline-block"
                      >
                        ↗ source article: {item.sourceArticleSlug}
                      </a>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[rgba(242,238,231,0.08)]">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(item.id)}
                            className="px-3 py-1.5 text-xs rounded-md bg-[#F2EEE7] text-[#141414] hover:bg-white"
                          >
                            Save edit
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 text-xs rounded-md border border-[rgba(242,238,231,0.14)] hover:bg-[rgba(242,238,231,0.06)]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => callAction(item.id, "approve")}
                            className="px-3 py-1.5 text-xs rounded-md bg-emerald-700 text-white hover:bg-emerald-800"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => copyDraft(item.draftText)}
                            className="px-3 py-1.5 text-xs rounded-md bg-[#C9A961] text-[#141414] hover:bg-[#B2924F] hover:text-white"
                          >
                            Copy draft
                          </button>
                          <button
                            onClick={() => {
                              const url = window.prompt("Posted URL (optional):");
                              callAction(item.id, "mark-posted", { postedUrl: url || undefined });
                            }}
                            className="px-3 py-1.5 text-xs rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                          >
                            Mark posted
                          </button>
                          <button
                            onClick={() => startEdit(item)}
                            className="px-3 py-1.5 text-xs rounded-md border border-[rgba(242,238,231,0.14)] hover:bg-[rgba(242,238,231,0.06)]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => callAction(item.id, "postpone")}
                            className="px-3 py-1.5 text-xs rounded-md border border-[rgba(242,238,231,0.14)] hover:bg-[rgba(242,238,231,0.06)]"
                          >
                            Postpone +{policy.expiryHours}h
                          </button>
                          <button
                            onClick={() => callAction(item.id, "skip")}
                            className="px-3 py-1.5 text-xs rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10"
                          >
                            Skip
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this item?")) callAction(item.id, "delete");
                            }}
                            className="px-3 py-1.5 text-xs rounded-md text-red-300 hover:bg-red-500/10 ml-auto"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent activity */}
        {recentActivity.length > 0 && (
          <section>
            <h2 className="font-serif text-base mb-4 text-[rgba(242,238,231,0.74)]">Last 24h activity</h2>
            <div className="space-y-2 text-sm">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 bg-[rgba(242,238,231,0.04)] border border-[rgba(242,238,231,0.08)] rounded"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border ${CHANNEL_CHIP_COLORS[item.channel]}`}
                    >
                      {channelPolicies[item.channel].label}
                    </span>
                    <span className="text-xs text-[rgba(242,238,231,0.62)]">{item.target}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span
                      className={`uppercase font-mono text-[10px] px-2 py-0.5 rounded ${
                        item.status === "posted"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : item.status === "skipped"
                            ? "bg-slate-500/15 text-slate-300"
                            : "bg-red-500/10 text-red-300"
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[rgba(242,238,231,0.42)]">
                      {item.actedAt ? timeAgo(item.actedAt) : ""}
                    </span>
                    {item.postedUrl && (
                      <a
                        href={item.postedUrl}
                        target="_blank"
                        rel="noopener"
                        className="text-[#B2924F] hover:underline"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${color}`}>
      <span className="font-mono text-sm font-medium">{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}

function ChannelTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-[#F2EEE7] text-[#141414] border-[#F2EEE7]"
          : "bg-[rgba(242,238,231,0.04)] border-[rgba(242,238,231,0.12)] text-[rgba(242,238,231,0.74)] hover:bg-[rgba(242,238,231,0.08)]"
      }`}
    >
      {label} <span className="opacity-60 ml-1">{count}</span>
    </button>
  );
}
