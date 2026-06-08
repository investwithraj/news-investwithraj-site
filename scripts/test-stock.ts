// Smoke-test the WIRED news image path (findBestStockImage + buildQueryForArticle),
// keyless + allowSynthetic:false (exactly how draft-engine calls it).
// Run: npx tsx scripts/test-stock.ts
import { findBestStockImage } from "../lib/stock/providers";
import { buildQueryForArticle } from "../lib/stock/query-builder";

const ARTS = [
  { title: "Al Barari villa lease resets Dubai ultra-prime rental ceiling at AED 7m", market: ["Dubai"], category: "market-pulse" },
  { title: "Wynn Al Marjan licence reshapes Ras Al Khaimah branded-residence yields", market: ["Ras Al Khaimah"], category: "developer-corporate" },
  { title: "Palm Jebel Ali re-rating: Nakheel reprices the frond premium", market: ["Dubai"], category: "launch" },
  { title: "Saadiyat Island cultural-district premium widens vs mainland Abu Dhabi", market: ["Abu Dhabi"], category: "market-pulse" },
  { title: "DLD weekly transactions hit AED 15.2B as Downtown Dubai leads", market: ["Dubai"], category: "market-pulse" },
];

async function main() {
  const t0 = Date.now();
  let ok = 0;
  for (const a of ARTS) {
    const q = buildQueryForArticle(a as never);
    const img = await findBestStockImage({ query: q, orientation: "landscape", minWidth: 1400, allowSynthetic: false });
    if (img) {
      ok++;
      console.log(`\n✓ ${a.title.slice(0, 55)}…`);
      console.log(`   query="${q}"  →  ${img.source} ${img.width}×${img.height} · ${img.license}`);
      console.log(`   credit: ${img.credit.slice(0, 70)}`);
      console.log(`   ${img.url.slice(0, 95)}`);
    } else {
      console.log(`\n✗ ${a.title.slice(0, 55)}…  query="${q}"  → none`);
    }
  }
  console.log(`\n=== ${ok}/${ARTS.length} sourced (keyless, no-AI) in ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
}
main();
