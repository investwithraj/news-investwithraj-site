// Barrel export — single import surface for all schema generators.
// Use: `import { newsArticleSchema, faqPageSchema } from "@/lib/schema";`

export { rajPersonSchema, rajPersonRef } from "./person";
export { newsOrgSchema, newsOrgRef, parentOrgRef } from "./organization";
export {
  newsArticleSchema,
  insightArticleSchema,
  speakableSchema,
  faqPageSchema,
} from "./article";
export { placeSchema, realEstateAgentSchema } from "./area";
export { breadcrumbSchema, BREADCRUMB_PRESETS, type Crumb } from "./breadcrumb";

/* ─── Composite injection helper ─────────────────────────────────────
   Useful when a page needs to emit multiple schemas as a single JSON-LD
   @graph (Google's preferred multi-schema form). Returns a single object
   suitable for direct JSON.stringify into a <script type="application/ld+json"> tag.
*/

export function asGraph(...schemas: Array<Record<string, unknown> | null>) {
  const nonNull = schemas.filter(
    (s): s is Record<string, unknown> => s !== null
  );
  return {
    "@context": "https://schema.org",
    "@graph": nonNull.map((s) => {
      // Strip the duplicate @context from individual schemas when in @graph form
      const { ...rest } = s;
      delete (rest as { "@context"?: unknown })["@context"];
      return rest;
    }),
  };
}
