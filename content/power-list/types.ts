// Power List — annual editorial. UAE's most influential real-estate figures.
// Manually curated by Raj; populated by year. Each entry = name + role +
// company + 1-line "why they matter" + optional avatar.

export type PowerListCategory =
  | "developer"
  | "broker"
  | "investor"
  | "regulator"
  | "sovereign"
  | "advisor"
  | "media";

export interface PowerListEntry {
  /** Rank position within the list */
  rank: number;
  /** Full name */
  name: string;
  /** Role / title */
  role: string;
  /** Company / affiliation */
  company: string;
  /** Category for grouping */
  category: PowerListCategory;
  /** 1-2 sentence "why they matter this year" */
  why: string;
  /** Optional last year's rank — drives delta arrow */
  lastYearRank?: number;
  /** Optional LinkedIn for cross-link */
  linkedin?: string;
}

export interface PowerListYear {
  /** Year — e.g. "2026" */
  year: string;
  /** Standfirst paragraph */
  intro: string;
  /** Ordered list (rank 1 first) */
  entries: PowerListEntry[];
  /** ISO publish timestamp */
  publishedAt: string;
}
