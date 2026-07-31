// Lightweight article-text extractor — fetches a URL and pulls the main body
// text (the <p> paragraphs), so the review cockpit can verify each figure in a
// draft against the REAL text of the sources it cites — not just a snippet.
//
// Zero-dependency readability heuristic: strip scripts/styles, collect <p>
// contents over a length threshold, decode the common entities. Good enough to
// match figures ("19.59 million", "AED 550 million") against the cited reporting.

import { safeFetchBytes } from "@/lib/sources/safe-fetch";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

/** Pull readable body text out of an HTML page. */
export function extractMainText(html: string, maxChars = 9000): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const paras = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      decodeEntities(m[1].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((p) => p.length > 40);

  let text = paras.join("  ");
  // Fallback: if a site renders body in <div>s not <p>s, take a stripped slice.
  if (text.length < 200) {
    text = decodeEntities(cleaned.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  }
  return text.slice(0, maxChars);
}

export interface FetchedArticleText {
  text: string;
  finalUrl: string | null;
}

/** Fetch a URL inside its verified-publisher boundary. */
export async function fetchArticleText(
  url: string,
  options: { allowedDomains: string[]; timeoutMs?: number },
): Promise<FetchedArticleText> {
  try {
    const result = await safeFetchBytes(url, {
      allowedDomains: options.allowedDomains,
      userAgent: UA,
      accept: "text/html,application/xhtml+xml",
      allowedContentTypes: /(?:text\/html|application\/xhtml\+xml)/i,
      maxBytes: 512 * 1024,
      timeoutMs: options.timeoutMs ?? 9_000,
      maxRedirects: 3,
    });
    return {
      text: extractMainText(result.bytes.toString("utf8")),
      finalUrl: result.finalUrl,
    };
  } catch {
    return { text: "", finalUrl: null };
  }
}
