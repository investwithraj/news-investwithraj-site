/** GENERATED SNAPSHOT: source lives in the main IWR content registry. */
export const INTELLIGENCE_SNAPSHOT = "2026-08-13.p0-p5" as const;
export type IntelligenceMarket = "Dubai" | "Abu Dhabi" | "Ras Al Khaimah" | "Sharjah" | "UAE";
export type DeveloperTier = 1 | 2 | 3;
export type CanonicalDeveloper = Readonly<{ slug: string; name: string; aliases: readonly string[]; markets: readonly IntelligenceMarket[]; tier: DeveloperTier; officialUrl: string }>;
export const REGULATOR_SOURCES = {
  dubaiDevelopers: "https://dubailand.gov.ae/en/eservices/approved-real-estate-developers/approved-developers/",
  dubaiProjects: "https://dubailand.gov.ae/en/eservices/real-estate-project-status-landing/real-estate-project-status/",
  dubaiOpenData: "https://dubailand.gov.ae/en/open-data/real-estate-data/",
  abuDhabiDirectory: "https://adrec.gov.ae/en/directory",
  rasAlKhaimahAuthority: "https://mun.rak.ae/",
} as const;
export const CANONICAL_DEVELOPERS: readonly CanonicalDeveloper[] = [
  ["emaar","Emaar Properties",["Emaar"],["Dubai","UAE"],1,"https://www.emaar.com/"],
  ["dubai-holding-real-estate","Dubai Holding Real Estate",["Dubai Holding","DHRE"],["Dubai","UAE"],1,"https://www.dubaiholding.com/"],
  ["meraas","Meraas",[],["Dubai"],1,"https://www.meraas.com/"],
  ["nakheel","Nakheel",[],["Dubai"],1,"https://www.nakheel.com/"],
  ["dubai-properties","Dubai Properties",["DP"],["Dubai"],1,"https://www.dp.ae/"],
  ["meydan","Meydan",["Meydan Group"],["Dubai"],1,"https://www.meydan.ae/"],
  ["aldar","Aldar Properties",["Aldar"],["Abu Dhabi","Dubai","UAE"],1,"https://www.aldar.com/"],
  ["modon","Modon",["Modon Holding","Modon Properties"],["Abu Dhabi","UAE"],1,"https://www.modon.com/"],
  ["damac","DAMAC Properties",["Damac"],["Dubai","UAE"],1,"https://www.damacproperties.com/"],
  ["sobha","Sobha Realty",["Sobha"],["Dubai","Abu Dhabi"],1,"https://www.sobharealty.com/"],
  ["arada","Arada",[],["Sharjah","Dubai","UAE"],1,"https://www.arada.com/"],
  ["wasl","Wasl",["Wasl Properties"],["Dubai"],1,"https://www.wasl.ae/"],
  ["majid-al-futtaim","Majid Al Futtaim",["MAF"],["Dubai","UAE"],1,"https://www.majidalfuttaim.com/"],
  ["expo-city-dubai","Expo City Dubai",["Expo City"],["Dubai"],1,"https://www.expocitydubai.com/"],
  ["dubai-south","Dubai South",[],["Dubai"],1,"https://www.dubaisouth.ae/"],
  ["marjan","Marjan",["Al Marjan Island"],["Ras Al Khaimah"],1,"https://marjan.ae/"],
  ["rak-properties","RAK Properties",[],["Ras Al Khaimah"],1,"https://www.rakproperties.ae/"],
  ["al-hamra","Al Hamra",["Al Hamra Real Estate Development"],["Ras Al Khaimah"],1,"https://www.alhamra.ae/"],
  ["omniyat","OMNIYAT",["Omniyat"],["Dubai"],2,"https://www.omniyat.com/"],
  ["hh","H&H Development",["H&H","H and H"],["Dubai"],2,"https://www.h-h.ae/"],
  ["shamal","Shamal Holding",["Shamal"],["Dubai"],2,"https://www.shamal.com/"],
  ["select-group","Select Group",[],["Dubai"],2,"https://www.select-group.ae/"],
  ["ellington","Ellington Properties",["Ellington"],["Dubai","Ras Al Khaimah"],2,"https://ellingtonproperties.ae/"],
  ["binghatti","Binghatti",["Binghatti Properties"],["Dubai"],2,"https://www.binghatti.com/"],
  ["beyond","BEYOND Developments",["Beyond"],["Dubai"],2,"https://www.beyonddevelopments.com/"],
  ["amali","Amali Properties",["Amali"],["Dubai"],2,"https://amaliproperties.com/"],
  ["imkan","IMKAN",["Imkan Properties"],["Abu Dhabi"],2,"https://www.imkan.ae/"],
  ["bloom","Bloom Holding",["Bloom Properties"],["Abu Dhabi","Dubai"],2,"https://bloomholding.com/"],
  ["jubail-island","Jubail Island Investment Company",["JIIC","Jubail Island"],["Abu Dhabi"],2,"https://jubailisland.ae/"],
  ["eagle-hills","Eagle Hills",[],["Abu Dhabi","Sharjah","UAE"],2,"https://www.eaglehills.com/"],
  ["alef","Alef Group",["Alef"],["Sharjah"],2,"https://www.alefgroup.ae/"],
  ["lead-development","LEAD Development",["Lead Development"],["Abu Dhabi"],2,"https://leaddevelopment.ae/"],
  ["ifa-hotels","IFA Hotels & Resorts",["IFA Hotels"],["Dubai","UAE"],2,"https://www.ifahotelsresorts.com/"],
  ["azizi","Azizi Developments",["Azizi"],["Dubai"],3,"https://www.azizidevelopments.com/"],
  ["danube","Danube Properties",["Danube"],["Dubai"],3,"https://www.danubeproperties.com/"],
  ["mag","MAG Lifestyle Development",["MAG"],["Dubai"],3,"https://mag.global/"],
  ["deyaar","Deyaar Development",["Deyaar"],["Dubai"],3,"https://www.deyaar.ae/"],
  ["union-properties","Union Properties",[],["Dubai"],3,"https://www.up.ae/"],
  ["nshama","Nshama",[],["Dubai"],3,"https://nshama.ae/"],
  ["samana","Samana Developers",["Samana"],["Dubai"],3,"https://samanadevelopers.com/"],
  ["imtiaz","Imtiaz Developments",["Imtiaz"],["Dubai"],3,"https://imtiaz.ae/"],
  ["tiger","Tiger Properties",["Tiger Group"],["Dubai","Sharjah"],3,"https://tigerproperties.ae/"],
  ["object-1","Object 1",["Object One"],["Dubai"],3,"https://object-1.com/"],
  ["leos","LEOS Developments",["Leos"],["Dubai"],3,"https://leosdevelopments.com/"],
  ["reportage","Reportage Properties",["Reportage"],["Abu Dhabi","Dubai"],3,"https://reportageuae.com/"]
].map(([slug,name,aliases,markets,tier,officialUrl]) => ({ slug, name, aliases, markets, tier, officialUrl })) as readonly CanonicalDeveloper[];
export function canonicalDeveloper(slug: string) { return CANONICAL_DEVELOPERS.find((developer) => developer.slug === slug); }
export function canonicalDeveloperForName(value: string) { const normalized=value.trim().toLocaleLowerCase("en"); return CANONICAL_DEVELOPERS.find((developer)=>[developer.name,...developer.aliases].some((candidate)=>candidate.toLocaleLowerCase("en")===normalized)); }
