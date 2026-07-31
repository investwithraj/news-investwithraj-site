import { AREAS } from "@/content/areas";
import type { NewsArticle } from "@/content/news/types";
import { DEVELOPERS } from "@/lib/developers";
import {
  articleMentionsArea,
  articleMentionsDeveloper,
  hasVerifiedEditorialImage,
  supportedImageAlt,
} from "@/lib/news-editorial";
import {
  getVerifiedAreaMedia,
  getVerifiedDeveloperMedia,
  type VerifiedMedia,
} from "@/lib/verified-media";

export type ArticleDisplayMedia = Readonly<{
  src: string;
  alt: string;
  credit: string;
  notice: string;
  label: "Report image" | "Area context" | "Developer context";
}>;

function recordedArticleMedia(
  article: NewsArticle,
): ArticleDisplayMedia | null {
  if (!hasVerifiedEditorialImage(article)) return null;

  return {
    src: article.heroImage.src,
    alt: supportedImageAlt(article),
    credit: article.heroImage.credit,
    notice: "Approved editorial context for this report.",
    label: "Report image",
  };
}

function contextualMedia(
  media: VerifiedMedia,
  label: ArticleDisplayMedia["label"],
): ArticleDisplayMedia {
  return {
    src: media.src,
    alt: media.alt,
    credit: media.credit || media.sourceLabel,
    notice: media.renderNotice,
    label,
  };
}

function contextualCandidates(article: NewsArticle): ArticleDisplayMedia[] {
  const areaCandidates = AREAS.flatMap((area) => {
    if (!articleMentionsArea(article, area)) return [];
    const media = getVerifiedAreaMedia(area.slug);
    return media ? [contextualMedia(media, "Area context")] : [];
  });

  const developerCandidates = DEVELOPERS.flatMap((developer) => {
    if (!articleMentionsDeveloper(article, developer)) return [];
    const media = getVerifiedDeveloperMedia(developer.slug);
    return media ? [contextualMedia(media, "Developer context")] : [];
  });

  return [...areaCandidates, ...developerCandidates];
}

export function resolveArticleDisplayMedia(
  article: NewsArticle,
): ArticleDisplayMedia | null {
  return recordedArticleMedia(article) ?? contextualCandidates(article)[0] ?? null;
}

export function planDistinctArticleMedia(
  articles: NewsArticle[],
): ReadonlyMap<string, ArticleDisplayMedia> {
  const plan = new Map<string, ArticleDisplayMedia>();
  const used = new Set<string>();

  for (const article of articles) {
    const ownMedia = recordedArticleMedia(article);
    if (ownMedia && !used.has(ownMedia.src)) {
      plan.set(article.slug, ownMedia);
      used.add(ownMedia.src);
    }
  }

  const unresolved = articles
    .filter((article) => !plan.has(article.slug))
    .map((article, index) => ({
      article,
      index,
      candidates: contextualCandidates(article),
    }));
  const frequency = new Map<string, number>();

  for (const { candidates } of unresolved) {
    for (const candidate of candidates) {
      frequency.set(candidate.src, (frequency.get(candidate.src) ?? 0) + 1);
    }
  }

  unresolved
    .sort(
      (left, right) =>
        left.candidates.length - right.candidates.length ||
        left.index - right.index,
    )
    .forEach(({ article, candidates }) => {
      const selected = [...candidates]
        .filter((candidate) => !used.has(candidate.src))
        .sort(
          (left, right) =>
            (frequency.get(left.src) ?? 0) -
            (frequency.get(right.src) ?? 0),
        )[0];

      if (!selected) return;
      plan.set(article.slug, selected);
      used.add(selected.src);
    });

  return plan;
}
