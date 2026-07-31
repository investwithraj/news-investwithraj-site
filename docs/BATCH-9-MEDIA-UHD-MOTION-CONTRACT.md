# Batch 9 · Orders 69–77 · Media, UHD and motion contract

Reviewed: 31 July 2026  
Site: `news.investwithraj.com`  
Machine contract: `config/media-contract.json`  
Executable audit: `scripts/audit-batch-9-media.mjs`  
Full inventory: `outputs/batch-9-orders-69-77-media/report.json`

## Outcome

The news site now separates three things that had previously been conflated:

1. a file existing in `public/`;
2. a file having a recorded source and rights state;
3. a file being approved and mounted on a public route.

The current saved run passes the hard contract:

| Measure | Result |
| --- | ---: |
| Public media files | 425 |
| Images | 394 |
| Videos | 20 |
| Audio | 11 |
| Total bytes | 135,978,905 |
| Referenced files | 59 |
| Unreferenced files | 366 |
| Missing literal references | 9 |
| Byte-identical duplicate groups | 0 |
| Hard contract violations | 0 |

The large unused count is intentional evidence of dormant legacy material, not
permission to mount it. The current redesigned shell uses source-recorded
editorial images and withholds unsupported article covers.

## Order 69 · complete media inventory

The JSON report contains, for every supported public image, video and audio:

- normalized public path;
- actual type, extension and byte size;
- actual image or MP4 width and height;
- SHA-256;
- source-code files that reference it;
- collection classification and approval state;
- missing, unreferenced and query/fragment path lists;
- every byte-identical duplicate group.

The nine missing literal references are preserved for cleanup. They comprise
dynamic templates, intentionally withheld old placeholder/article covers and
one dormant portrait fallback. The current article renderer shows an honest
verified-image hold when an article cover is unsupported.

## Order 72 · verified news-media ledger

`lib/verified-media.ts` now derives its public registries from
`config/media-contract.json`; the UI and the audit no longer maintain
independent truth.

Each of the 15 approved context assets records:

- exact subject;
- actual `3840 × 2160` derivative;
- source provider, creator/source identifier and URL;
- rights status, licence URL where available and retained credit;
- photograph, satellite or official-render type;
- a visible render/context notice;
- exact area/developer route and role;
- `context-only` evidence use.

Official renders explicitly say they represent design intent—not completion,
view, availability or market evidence. Developer media states that no
affiliation is implied.

Unknown media defaults to **withheld**. Unsupported article covers remain
withheld instead of receiving random or unrelated real-estate imagery.

## Order 73 · video and audio register

All 20 video files and all 11 audio files are recorded as dormant and withheld.
They are not mounted by the current public layout.

Video groups:

- `/hero.mp4`;
- `/brand/ident-fall.mp4`;
- five `/cinema/library/` films;
- eleven `/cinema/raw/` production files;
- two `/cinema/v21/` motion files.

Audio groups:

- two ambient tracks;
- one legacy Raj intro;
- eight UI sounds.

`lib/audio.ts` now exposes the complete dormant register and refuses to create
an audio context unless:

1. the browser reports a prior user activation; and
2. the saved master preference is explicitly `on`.

Playback cannot unlock itself during mount or page load. The public layout
still mounts no audio control, so all files remain dormant.

## Order 74 · UHD contract

- Fullscreen media must measure at least `3840 × 2160`.
- Smaller responsive derivatives are legal only in non-fullscreen roles.
- A derivative must retain the same subject.
- Runtime fullscreen video must later pass a browser assertion against
  `video.videoWidth` and `video.videoHeight`.
- Raj’s real `2160 × 2880` portrait, if copied from the advisory archive for
  `/about`, is classified as owner-supplied portrait-use UHD—not a fullscreen
  16:9 asset.

No current public video is mounted, so the runtime video assertion is correctly
deferred to the final browser grand test.

## Order 75 · zero repetition and fallback

The hard route check rejects:

- the same normalized source assigned twice on one route;
- two filenames with the same SHA-256 assigned on one route.

The audit follows the import graph from all 19 public page entry points, so
media mounted through nested components is checked rather than only media
written directly in `page.tsx`. It currently finds zero same-source
browser-review items.

The current public inventory has zero byte-identical duplicate groups.

Fallback rules are strict:

- same subject only;
- no random pool;
- no generic “luxury” substitution;
- no unrelated geography;
- an honest hold state when no verified image exists.

## Order 76 · motion contract

The current redesigned news shell has no smooth-scroll engine and no public
video-motion dependency. Its contract bans sci-fi, HUD, holographic, particle,
cyber and nested-scroll grammar.

Legacy futurism/v16/v21 components still exist in source, but are explicitly
dormant and not part of the mounted public shell. Their presence cannot grant
media approval.

The inventory warning about `Math.random` names three dormant canvas files.
They are not mounted and are not approved media fallback sources.

## Order 77 · provenance rules

### Motion Array

- Manual, project-specific download only.
- Asset ID, creator, catalogue URL and private receipt required.
- Source/derivative SHA-256 chain required.
- No catalogue warehousing.
- No asset currently approved on the news site.

### Adobe Stock

- Clean licensed original only.
- Adobe asset ID and licence record required.
- Watermarked/preview files prohibited.
- No asset currently approved on the news site.

### Higgsfield

- Never property, place, person, transaction or documentary evidence.
- Never an AI background video.
- Future use requires Raj’s approval and clear abstract-art labelling outside
  evidence-bearing positions.
- No asset currently approved on the news site.

## Commands

Concise audit:

```powershell
node scripts/audit-batch-9-media.mjs
```

Refresh the complete machine-readable report:

```powershell
node scripts/audit-batch-9-media.mjs --json outputs/batch-9-orders-69-77-media/report.json
```

The command exits non-zero only for a hard contract violation. Inventory
signals remain preserved as warnings or explicit reference lists.
