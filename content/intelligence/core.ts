import type { IntelligenceMarket } from "./registry";
export type CanonicalArea = Readonly<{ slug: string; name: string; emirate: Exclude<IntelligenceMarket,"UAE">; decisionFamily: "waterfront"|"urban"|"master-community"|"island" }>;
export type CanonicalProject = Readonly<{ slug: string; name: string; developerSlug: string; areaSlug: string; officialSourceUrl: string; regulatorProjectId: string|null; verificationState: "verified-source"|"registry-id-pending" }>;
export const CANONICAL_AREAS: readonly CanonicalArea[] = [
  { slug:"palm-jebel-ali", name:"Palm Jebel Ali", emirate:"Dubai", decisionFamily:"island" },
  { slug:"palm-jumeirah", name:"Palm Jumeirah", emirate:"Dubai", decisionFamily:"island" },
  { slug:"downtown-dubai", name:"Downtown Dubai", emirate:"Dubai", decisionFamily:"urban" },
  { slug:"dubai-marina", name:"Dubai Marina", emirate:"Dubai", decisionFamily:"waterfront" },
  { slug:"bluewaters-island", name:"Bluewaters Island", emirate:"Dubai", decisionFamily:"island" },
  { slug:"dubai-harbour", name:"Dubai Harbour", emirate:"Dubai", decisionFamily:"waterfront" },
  { slug:"dubai-hills-estate", name:"Dubai Hills Estate", emirate:"Dubai", decisionFamily:"master-community" },
  { slug:"dubai-creek-harbour", name:"Dubai Creek Harbour", emirate:"Dubai", decisionFamily:"waterfront" },
  { slug:"saadiyat-island", name:"Saadiyat Island", emirate:"Abu Dhabi", decisionFamily:"island" },
  { slug:"yas-island", name:"Yas Island", emirate:"Abu Dhabi", decisionFamily:"island" },
  { slug:"hudayriyat-island", name:"Hudayriyat Island", emirate:"Abu Dhabi", decisionFamily:"island" },
  { slug:"al-marjan-island", name:"Al Marjan Island", emirate:"Ras Al Khaimah", decisionFamily:"island" },
] as const;
export const CANONICAL_PROJECTS: readonly CanonicalProject[] = [
  { slug:"marsa-al-saadiyat", name:"Marsa Al Saadiyat", developerSlug:"aldar", areaSlug:"saadiyat-island", officialSourceUrl:"https://www.aldar.com/en/news-and-media/his-highness-sheikh-khaled-bin-mohamed-bin-zayed-al-nahyan-inaugurates-aed-100-billion-marsa-al-saadiyat", regulatorProjectId:null, verificationState:"registry-id-pending" },
  { slug:"hudayriyat-golf-estates", name:"Hudayriyat Golf Estates", developerSlug:"modon", areaSlug:"hudayriyat-island", officialSourceUrl:"https://www.modon.com/", regulatorProjectId:null, verificationState:"registry-id-pending" },
  { slug:"palm-jebel-ali", name:"Palm Jebel Ali", developerSlug:"nakheel", areaSlug:"palm-jebel-ali", officialSourceUrl:"https://www.nakheel.com/en/communities/palm-jebel-ali", regulatorProjectId:null, verificationState:"registry-id-pending" },
  { slug:"wynn-al-marjan", name:"Wynn Al Marjan Island", developerSlug:"marjan", areaSlug:"al-marjan-island", officialSourceUrl:"https://www.wynnresorts.com/", regulatorProjectId:null, verificationState:"registry-id-pending" },
] as const;
export function canonicalArea(slug:string){return CANONICAL_AREAS.find((area)=>area.slug===slug)}
export function canonicalProject(slug:string){return CANONICAL_PROJECTS.find((project)=>project.slug===slug)}
