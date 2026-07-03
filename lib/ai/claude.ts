// Claude API client — used by F16 personalized briefs + F18 translation.
// Anthropic key from env. Graceful no-op when not configured.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

export function isClaudeConfigured(): boolean {
  return Boolean(ANTHROPIC_API_KEY);
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeOptions {
  /** System prompt */
  system?: string;
  /** Conversation history */
  messages: ClaudeMessage[];
  /** Max output tokens — defaults to 1500 (long enough for a 500w brief) */
  maxTokens?: number;
  /** Temperature 0-1 */
  temperature?: number;
  /** Model override (e.g. a faster model for time-boxed serverless work). */
  model?: string;
}

export interface ClaudeResult {
  ok: boolean;
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

/** Single-call Claude completion. */
export async function callClaude(opts: ClaudeOptions): Promise<ClaudeResult> {
  if (!isClaudeConfigured()) {
    return { ok: false, error: "ANTHROPIC_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model ?? ANTHROPIC_MODEL,
        max_tokens: opts.maxTokens ?? 1500,
        temperature: opts.temperature ?? 0.4,
        system: opts.system,
        messages: opts.messages,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Claude API ${res.status}: ${errText.slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = data.content?.filter((c) => c.type === "text").map((c) => c.text).join("") || "";
    return {
      ok: true,
      text,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown Claude error",
    };
  }
}

/* ─── Web-research variant ──────────────────────────────────────────────
   Single completion with Anthropic's server-side web_search tool enabled, so
   Claude researches a story live (searches, reads the real reporting) before
   answering. Handles the `pause_turn` stop reason (long server-side tool
   turns) by continuing the turn. Returns the accumulated text + every source
   URL the search surfaced (for cross-checking the model's own citations). */

interface ClaudeContentBlock {
  type: string;
  text?: string;
  content?: Array<{ type: string; url?: string; title?: string }>;
}

export interface ClaudeResearchResult extends ClaudeResult {
  /** Every URL surfaced by web_search across the turn. */
  searchedUrls?: string[];
  searchCount?: number;
}

export async function callClaudeResearch(
  opts: ClaudeOptions & { maxSearches?: number },
): Promise<ClaudeResearchResult> {
  if (!isClaudeConfigured()) return { ok: false, error: "ANTHROPIC_API_KEY not set" };

  const messages: ClaudeMessage[] | Array<{ role: string; content: unknown }> = [
    ...opts.messages,
  ];
  const searchedUrls = new Set<string>();
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let searchCount = 0;

  try {
    for (let step = 0; step < 6; step++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model ?? ANTHROPIC_MODEL,
          max_tokens: opts.maxTokens ?? 4000,
          temperature: opts.temperature ?? 0.4,
          system: opts.system,
          messages,
          tools: [
            { type: "web_search_20250305", name: "web_search", max_uses: opts.maxSearches ?? 4 },
          ],
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return { ok: false, error: `Claude API ${res.status}: ${errText.slice(0, 300)}` };
      }
      const data = (await res.json()) as {
        content?: ClaudeContentBlock[];
        stop_reason?: string;
        usage?: { input_tokens: number; output_tokens: number };
      };
      inputTokens += data.usage?.input_tokens ?? 0;
      outputTokens += data.usage?.output_tokens ?? 0;

      for (const block of data.content ?? []) {
        if (block.type === "text" && block.text) text += block.text;
        if (block.type === "server_tool_use") searchCount++;
        if (block.type === "web_search_tool_result") {
          for (const r of block.content ?? []) {
            if (r.url) searchedUrls.add(r.url);
          }
        }
      }

      if (data.stop_reason === "pause_turn" && data.content) {
        // Continue the paused turn — re-send with the assistant's partial turn.
        (messages as Array<{ role: string; content: unknown }>).push({
          role: "assistant",
          content: data.content,
        });
        continue;
      }
      break;
    }

    return {
      ok: true,
      text,
      inputTokens,
      outputTokens,
      searchedUrls: [...searchedUrls],
      searchCount,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown Claude error" };
  }
}
