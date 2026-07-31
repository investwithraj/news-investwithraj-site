// Barrel export — single import surface for all schema generators.
// Use: `import { newsArticleSchema, faqPageSchema } from "@/lib/schema";`

export { RAJ_PERSON_ID, rajPersonSchema, rajPersonRef } from "./person";
export {
  NEWS_ORG_ID,
  newsOrgSchema,
  newsOrgRef,
  parentOrgRef,
} from "./organization";
export {
  NEWS_WEBSITE_ID,
  newsWebsiteSchema,
  newsWebsiteRef,
} from "./website";
export {
  newsArticleSchema,
  insightArticleSchema,
  speakableSchema,
  faqPageSchema,
} from "./article";
export { placeSchema, realEstateAgentSchema } from "./area";
export { breadcrumbSchema, BREADCRUMB_PRESETS, type Crumb } from "./breadcrumb";
export {
  collectionPageSchemas,
  newsImageObjectSchema,
  type CollectionItem,
} from "./collection";

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
