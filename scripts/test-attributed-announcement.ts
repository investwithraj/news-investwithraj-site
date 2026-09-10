import assert from "node:assert/strict";
import { assessAttributedAnnouncement, type AttributedAnnouncementInput } from "../lib/news-review/claim-support.js";

// Exact bounded paragraphs retrieved from WAM's article / official API on
// 10 September 2026. The test never fetches or publishes anything.
const sourceUrl = "https://www.wam.ae/en/article/c256iib-dubai-developers-launch-multi-billion-dirham";
export const sourceText = `Hussein Ezz Eddin, Chief Sales Officer at Prestige One Developments, said the company plans to invest AED3 billion to AED4 billion during the 2026-2027 property season through land acquisitions and new residential and commercial projects in key locations across Dubai.
He said the company has launched four projects since the beginning of the year and plans to launch a further seven to eight during the current season.`;
const input: AttributedAnnouncementInput = {
  format: "short-update", category: "developer-corporate",
  reportingBasis: { sourceUrl, speaker: "Hussein Ezz Eddin", organization: "Prestige One Developments", statementKind: "corporate-intent" },
  evidence: [{ url: sourceUrl, publisher: "WAM (Emirates News Agency)", publisherDomain: "wam.ae", publisherAliases: ["wam (emirates news agency)", "wam"], text: sourceText }],
  segments: [
    { field: "title", text: "Prestige One plans to invest AED3 billion to AED4 billion" },
    { field: "body", text: "Hussein Ezz Eddin, the Chief Sales Officer of Prestige One Developments, told WAM the company plans to invest AED3 billion to AED4 billion for the 2026-2027 property season. Prestige One plans new residential and commercial projects in Dubai. Prestige One plans land acquisitions and new commercial projects across key locations in Dubai. Prestige One plans to invest through land acquisitions and new residential and commercial projects across Dubai. Prestige One plans to launch a further seven to eight projects during the current season." },
  ],
};

const result = assessAttributedAnnouncement(input);
assert.equal(result.ok, true, JSON.stringify(result, null, 2));
assert.ok(input.segments[1].text.split(/\s+/u).length >= 80);

function mustHold(label: string, mutate: (candidate: AttributedAnnouncementInput) => void) {
  const candidate = structuredClone(input);
  mutate(candidate);
  const result = assessAttributedAnnouncement(candidate);
  assert.equal(result.ok, false, `${label}: ${JSON.stringify(result)}`);
  assert.equal(result.support.verdict, "manual", label);
}

const naturalVariants = structuredClone(input);
naturalVariants.segments = [
  { field: "title", text: "Prestige One plans AED3 billion to AED4 billion Dubai investment" },
  { field: "subtitle", text: "Prestige One's plans cover land purchases and new residential and commercial projects" },
  { field: "tldr[0]", text: "Prestige One plans seven to eight further launches this season." },
  { field: "body", text: input.segments[1].text },
];
assert.equal(assessAttributedAnnouncement(naturalVariants).ok, true,
  JSON.stringify(assessAttributedAnnouncement(naturalVariants), null, 2));

mustHold("no typed basis", (candidate) => { delete candidate.reportingBasis; });
mustHold("wrong editorial format", (candidate) => { candidate.format = "long-report"; });
mustHold("wrong category", (candidate) => { candidate.category = "market-pulse"; });
mustHold("wrong basis source", (candidate) => { candidate.reportingBasis!.sourceUrl += "?different=1"; });
mustHold("unsafe source protocol", (candidate) => { candidate.reportingBasis!.sourceUrl = "http://www.wam.ae/story"; });
mustHold("source absent", (candidate) => { candidate.evidence = []; });
mustHold("basis not verified by two arbitrary sources", (candidate) => { candidate.evidence = [...candidate.evidence, { ...candidate.evidence[0], url: "https://other.example/news" }]; });
mustHold("swapped basis speaker", (candidate) => { candidate.reportingBasis!.speaker = "Raja Jawad Ahmed"; });
mustHold("swapped basis organization", (candidate) => { candidate.reportingBasis!.organization = "Union Properties"; });
mustHold("source speaker swap", (candidate) => { candidate.evidence = candidate.evidence.map((record) => ({ ...record, text: record.text.replaceAll("Hussein Ezz Eddin", "Someone Else") })); });
mustHold("source organization swap", (candidate) => { candidate.evidence = candidate.evidence.map((record) => ({ ...record, text: record.text.replaceAll("Prestige One Developments", "Union Properties") })); });
mustHold("source no intent", (candidate) => { candidate.evidence = candidate.evidence.map((record) => ({ ...record, text: record.text.replaceAll("plans", "promises") })); });
mustHold("source denied speech must not become positive attribution", (candidate) => { candidate.evidence = candidate.evidence.map((record) => ({ ...record, text: record.text.replace("said the company", "denied that anyone said the company") })); });
mustHold("source negated affiliation must not bind a company", (candidate) => { candidate.evidence = candidate.evidence.map((record) => ({ ...record, text: record.text.replace("Chief Sales Officer at", "not Chief Sales Officer at") })); });
mustHold("body attribution removed", (candidate) => { candidate.segments = [{ field: "body", text: "Prestige One plans new residential and commercial projects in Dubai." }]; });
mustHold("invented executive role", (candidate) => { candidate.segments = candidate.segments.map((segment) => ({ ...segment, text: segment.text.replace("Chief Sales Officer", "Chief Executive Officer") })); });
mustHold("speaker role/entity injection", (candidate) => { candidate.segments = candidate.segments.map((segment) => ({ ...segment, text: segment.text.replace("Chief Sales Officer", "Chief Sales Officer and World Champion") })); });

// Review regressions: matching views are never accepted as caller identities.
for (const sentinel of ["BoundCorporation", "boundcorporation", "ＢｏｕｎｄＣｏｒｐｏｒａｔｉｏｎ"]) {
  mustHold("raw matching sentinel", (candidate) => {
    candidate.segments = [...candidate.segments, { field: "body", text: `${sentinel} plans new residential and commercial projects in Dubai.` }];
  });
}
mustHold("source matching sentinel", (candidate) => {
  candidate.evidence = candidate.evidence.map((record) => ({ ...record, text: `${record.text} BoundCorporation plans Dubai developments.` }));
});
mustHold("definite developer cannot inherit an article-level identity", (candidate) => {
  candidate.evidence = candidate.evidence.map((record) => ({ ...record, text: `${record.text} Union Properties opened its exhibition in Dubai.` }));
  candidate.segments = [...candidate.segments, { field: "body", text: "Union Properties introduced the Dubai exhibition. The developer plans new residential and commercial projects in Dubai." }];
});
for (const noun of ["The developer", "The company", "The developer's", "The company's"]) {
  mustHold("unbound definite company noun", (candidate) => {
    candidate.segments = [...candidate.segments, { field: "body", text: `${noun} plans new residential and commercial projects in Dubai.` }];
  });
}
const explicitCompanyNoun = structuredClone(input);
explicitCompanyNoun.segments = explicitCompanyNoun.segments.map((segment) => ({ ...segment,
  text: segment.text.replace("told WAM the company plans", "told WAM the developer plans") }));
assert.equal(assessAttributedAnnouncement(explicitCompanyNoun).ok, true,
  "the developer remains bound inside its explicit named-speaker/company sentence");

for (const qualifySource of [
  (text: string) => text.replace("across Dubai.", "across Dubai, subject to regulatory approval."),
  (text: string) => text.replace("plans to invest", "plans to invest, if approved,"),
  (text: string) => text.replace("across Dubai.", "across Dubai while approval is pending."),
  (text: string) => text.replace("across Dubai.", "across Dubai. The plan is subject to regulatory approval."),
  (text: string) => text.replace("current season.", "current season, contingent on permits."),
  (text: string) => text.replace("current season.", "current season unless financing is withdrawn."),
]) {
  mustHold("source condition cannot be dropped", (candidate) => {
    candidate.evidence = candidate.evidence.map((record) => ({ ...record, text: qualifySource(record.text) }));
  });
}
mustHold("a qualified article remains manual until conditions can be matched", (candidate) => {
  candidate.segments = candidate.segments.map((segment) => ({ ...segment, text: segment.text.replace("plans to invest", "plans to invest, if approved,") }));
  candidate.evidence = candidate.evidence.map((record) => ({ ...record, text: record.text.replace("plans to invest", "plans to invest, if approved,") }));
});

for (const claim of [
  "Prestige One will invest AED3 billion to AED4 billion.",
  "Prestige One has invested AED3 billion to AED4 billion.",
  "Prestige One guarantees seven to eight project launches.",
  "Prestige One plans new residential and commercial projects with guaranteed returns.",
  "Prestige One plans to deliver luxury developments for investors.",
  "Prestige One plans to invest AED30 billion to AED40 billion.",
  "Prestige One plans to invest AED4 billion to AED3 billion.",
  "Prestige One plans to invest AED3 billion to AED4 billion for the 2027-2028 property season.",
  "Prestige One plans to launch a further nine to ten projects during the current season.",
  "Prestige One plans new residential and commercial projects in Sharjah.",
  "Union Properties plans new residential and commercial projects in Dubai.",
  "They plan new residential and commercial projects in Dubai.",
]) {
  mustHold(`unsupported claim: ${claim}`, (candidate) => { candidate.segments = [...candidate.segments, { field: "body", text: claim }]; });
}

mustHold("exact source copying", (candidate) => { candidate.segments = [{ field: "body", text: sourceText.split("\n")[0] }]; });
mustHold("copied inner passage with changed speaker framing", (candidate) => { candidate.segments = [{ field: "body", text: sourceText.split("\n")[0].replace("Hussein Ezz Eddin, Chief Sales Officer at Prestige One Developments, said", "Hussein Ezz Eddin of Prestige One Developments told WAM") }]; });
mustHold("another speaker cannot lend an adjacent plan", (candidate) => {
  candidate.evidence = candidate.evidence.map((record) => ({ ...record,
    text: record.text.replace("He said", "Another executive described a different company. He said") }));
});

// Asserted source context has no announcement exception; the existing matcher
// must align it independently. This extra event sentence is synthetic.
const context = structuredClone(input);
context.evidence = context.evidence.map((record) => ({ ...record, text: `${record.text}\nThe International Property Show opened its exhibition in Dubai.` }));
context.segments = [...context.segments, { field: "body", text: "The International Property Show introduced the Dubai exhibition." }];
assert.equal(assessAttributedAnnouncement(context).ok, true, JSON.stringify(assessAttributedAnnouncement(context)));
const falseContext = structuredClone(context);
falseContext.segments = [...falseContext.segments, { field: "body", text: "The International Property Show introduced the Sharjah exhibition." }];
assert.equal(assessAttributedAnnouncement(falseContext).ok, false);

console.log("PASS: attributed announcement matching, WAM intent, natural phrasing, identity and attribution, original-copy limits, numeric/date/range controls, forecast strengthening and source-bound context");
