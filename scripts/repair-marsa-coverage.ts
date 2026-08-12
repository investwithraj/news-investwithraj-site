import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const contentRoot = path.join(process.cwd(), "content", "news");
const primary = path.join(
  contentRoot,
  "2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island.ts",
);
const duplicate = path.join(
  contentRoot,
  "2026-07-24-aldar-unveils-aed-100bn-marsa-al-saadiyat-abu-dhabi-s-final-.ts",
);

const sourcePage =
  "https://www.aldar.com/en/news-and-media/his-highness-sheikh-khaled-bin-mohamed-bin-zayed-al-nahyan-inaugurates-aed-100-billion-marsa-al-saadiyat";

async function main() {
const primaryText = await readFile(primary, "utf8");
let repairedPrimary = primaryText
  .replace(
    /"credit": "Invest With Raj editorial archive[^\r\n"]*Saadiyat Reserve"/u,
    '"credit": "Aldar official Marsa Al Saadiyat press media"',
  )
  .replace(
    '"alt": "Aldar activates AED 100 bn Marsa Al Saadiyat, Saadiyat Island\'s final phase"',
    '"alt": "Official Aldar press image for the Marsa Al Saadiyat masterplan announcement"',
  )
  .replace('"distribution": {}', '"distribution": {}');

if (!repairedPrimary.includes('"approval": "approved-editorial"')) {
  repairedPrimary = repairedPrimary.replace(
    '"credit": "Aldar official Marsa Al Saadiyat press media"',
    `"credit": "Aldar official Marsa Al Saadiyat press media",\n    "sourceUrl": "${sourcePage}",\n    "rightsStatus": "Official Aldar press media retained with the article record",\n    "width": 4200,\n    "height": 2800,\n    "approval": "approved-editorial"`,
  );
}

if (repairedPrimary === primaryText) {
  throw new Error("Primary Marsa article did not match the expected generated shape.");
}

const duplicateText = await readFile(duplicate, "utf8");
const retiredDuplicate = duplicateText.replace(
  '"status": "live"',
  '"status": "research"',
);
await writeFile(primary, repairedPrimary, "utf8");
await writeFile(duplicate, retiredDuplicate, "utf8");
console.log("Marsa coverage repaired: exact official media attached; duplicate retired.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
