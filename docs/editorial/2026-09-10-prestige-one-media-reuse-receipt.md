# Dubai-context stock image reuse — 10 September 2026

This is a reuse receipt for an existing owner-approved stock-account asset. It is not a new photographer credit, licence certificate or claim of authorship.

## Exact source and authority

- Source: IWR main site's `public/media/licensed-real/dubai-golden.jpg`.
- Native JPEG: 7728 × 5152; 10,282,284 bytes. Copy unchanged; do not upscale or re-encode.
- Image SHA-256: `8841d0f06bc9c51a034691724dc14d0c4a5b58dc2d5ac32a2340ffb7437d8688`.
- Main-site clearance: `config/public-media-clearance.json`, exact `/media/licensed-real/dubai-golden.jpg` record, `releaseDecision: cleared`, `rightsState: owner-approved-stock-account`, `reusePolicy: normal`.
- Authority: `config/media-owner-approval.json`, recorded 2026-09-09, approved by Raj Tomar as business owner and media-account holder. Original approval file SHA-256: `31f102591465fa587e75fae9f60942dc9cfe8ea08f40b1b83d6fb61cf1dc6351`.
- Original approved collection: `stock-account-archive`; use: Dubai and UAE editorial, service and market context.
- Additional source records: `docs/migration/current-public-media-register.csv` and `docs/VISUAL-ASSET-REGISTER.md` in the main site. The historical register lists the provider as `local stock-licensed production archive`, creator as `not recorded`, and a missing private receipt. The later owner approval is the authority for this reuse; no independent stock invoice verification is asserted.
- On 2026-09-10 Raj authorised use of existing stock on the website and newsroom. This same-brand Dubai-context reuse is within that request.

## Locked destination and meaning

- Candidate: `prestige-one-investment-2026-09-10`.
- Draft: `be570910-2026-4090-8090-100000000004`.
- Article: `2026-09-10-prestige-one-dubai-investment-plan`.
- Destination: `public/news/2026-09-10-prestige-one-dubai-investment-plan/cover.jpg`.
- Source URL: `https://www.investwithraj.com/media/licensed-real/dubai-golden.jpg`.
- Rights status: `licensed`, on the recorded owner-approved stock-account basis above.
- Credit: `Invest With Raj stock-account archive; Dubai city context, not a Prestige One project`.
- Alt: `Dubai skyline at sunset, shown as city context`.

The photograph depicts a Dubai skyline at sunset. It illustrates the location of the reported plans, not a Prestige One development, event, current construction state, endorsement, project delivery or photographer identity.

## Protected workflow

`POST /api/news/draft/[id]/reuse-curated-media` accepts only `candidateKey`, `expectedRevision`, `expectedRecordVersion` and `expectedContentHash`, using the existing protected pipeline header. It rejects unknown candidates and caller-provided assets, rights, credits or paths. The ordinary signed-session media approval route is unchanged.

The exact cover must already exist on the configured publication branch. The reuse service reads and decodes its actual bytes using the existing GitHub media inspector, checks the fixed hash, JPEG format and dimensions, then stores an immutable ledger with reviewer `owner-approved-stock-reuse` and the source authority fields. `approvedAt` is the actual server reuse time, not backdated to the original owner approval. A retry reinspects the image and may only return an exactly matching existing ledger.

Curated staging checks the required approval before producing publication outputs, for both a new draft and an identical staged draft. Publication still runs its source, integrity, concurrency and final image-byte checks. No media is uploaded, copied or published by the reuse endpoint itself.

The dependency-free `curated-media-context.ts` helper identifies only this exact slug, image path, alt and credit. Its photograph-derived description is separate from facts supported by the article's reporting source. This helper does not approve image bytes or satisfy the mandatory publication ledger check; all other image descriptions remain subject to the normal evidence checks.
