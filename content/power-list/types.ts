// The Power List is an evidence-led annual research file. Entries are
// published in editorial order; the model makes no promise about list size or
// numeric rank.

export type PowerListCategory =
  | "developer"
  | "broker"
  | "investor"
  | "regulator"
  | "sovereign"
  | "advisor"
  | "media";

export interface PowerListEvidence {
  label: string;
  url: string;
}

export interface PowerListEntry {
  name: string;
  role: string;
  company: string;
  category: PowerListCategory;
  /** Evidence-led editorial case for inclusion in this edition. */
  caseForInclusion: string;
  /** Public sources supporting the case for inclusion. */
  evidence: PowerListEvidence[];
  /** Optional public professional profile. */
  linkedin?: string;
}

export interface PowerListYear {
  year: string;
  intro: string;
  /** Editorial sequence, not a numeric ranking. */
  entries: PowerListEntry[];
  publishedAt: string;
  modifiedAt?: string;
}
