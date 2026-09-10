# Daily news image catalogue

Raj requested suitable real images for continuing daily news on 10 September
2026, including images sourced online. This catalogue removes repeated image
selection for exact, already-cleared context photographs. It does not approve
arbitrary images or turn a city photograph into a named project photograph.

## Existing stock-account originals

Owner authority: the main website's `config/media-owner-approval.json`, approved
by Raj Tomar on 9 September 2026. SHA-256:
`31f102591465fa587e75fae9f60942dc9cfe8ea08f40b1b83d6fb61cf1dc6351`.
Both originals belong to its exact stock-account path set. Retain the recorded
archive credit; no photographer or provider is invented.

| News catalogue file | Original main-site file | Native dimensions | SHA-256 |
|---|---|---|---|
| `public/news-stock/dubai-sunset.jpg` | `public/media/licensed-real/dubai-golden.jpg` | 7728 × 5152 | `8841d0f06bc9c51a034691724dc14d0c4a5b58dc2d5ac32a2340ffb7437d8688` |
| `public/news-stock/dubai-night.jpg` | `public/media/licensed-real/dubai-stock.jpg` | 7952 × 5304 | `d738b05de0caa36596bbef621c2a1e57b19ace0722931216cdb6eb5ff658e6f8` |

The originals are copied without enlargement or recompression. They show the
Dubai skyline and Downtown Dubai. They may illustrate explicitly Dubai news
as city context, not a project's appearance, progress, availability or delivery.
The caption states that distinction. They are not used for Abu Dhabi or RAK.

## Online originals added under Raj's 10 September request

Permission record: `config/news-open-stock-authorization.json`, SHA-256
`433c197a4409c357c8ac2323c915ed6264c608e59e1a5c07cb8f199436e6084a`.
This is permission to select and use appropriately licensed online photographs,
not a claim that they came from Raj's paid stock account.

### Abu Dhabi skyline at sunset

- Creator: Robert Haandrikman. Photograph: 19 December 2016.
- [Source and attribution](https://commons.wikimedia.org/wiki/File:Skyline_of_Abu_Dhabi_at_sunset.jpg).
- [Original](https://upload.wikimedia.org/wikipedia/commons/0/0e/Skyline_of_Abu_Dhabi_at_sunset.jpg).
- [CC BY 2.0 licence](https://creativecommons.org/licenses/by/2.0/).
- File: `public/news-stock/abu-dhabi-sunset.jpg`; 6720 × 3270; 12,937,476 bytes.
- SHA-256: `beac735391f514a147bde0a332316f4aad90a0031646d6e3ec088ad6390243c7`.
- Unchanged original retained. Public article uses full-width framing, creator,
  archive date, source and licence links. Responsive delivery may resize it.
- Scope: broad Abu Dhabi city context only, not current construction progress.
  Preserve broad composition; do not isolate individual buildings.

### Ras Al Khaimah coastal hospitality

- Creator: Marjan / Pexels. Photograph: 10 March 2021.
- [Source and attribution](https://www.pexels.com/photo/an-aerial-shot-of-the-rixos-bab-al-bahr-in-ras-al-khaimah-10484112/).
- [Original](https://images.pexels.com/photos/10484112/pexels-photo-10484112.jpeg?cs=srgb&dl=pexels-marjan-147528816-10484112.jpg&fm=jpg).
- [Pexels licence](https://www.pexels.com/license/).
- File: `public/news-stock/ras-al-khaimah-coast.jpg`; 5472 × 3078; 2,388,737 bytes.
- SHA-256: `00d599999624f146e3acee32762b4ada67f4d30d657c5486f3f78832630cba24`.
- Scope: RAK hospitality/tourism context mentioning Al Marjan or Rixos, excluding
  launch reports. Caption names the existing Rixos Bab Al Bahr resort and archive
  date. Never label it as Wynn or an announced project's image.

Both files passed native ffprobe measurement and a full Sharp pixel decode.

## Operational controls

- The model cannot choose an asset, source credit or approval.
- Selection happens before the draft's content hash is sealed.
- Only a listed original with matching native dimensions and SHA-256 can be reused.
- The image-only Git operation cannot overwrite an existing different cover.
- The draft is reloaded after attachment; revisions and content must still match.
- Source verification and publication checks remain separate from image selection.
- Newly sourced open-stock files require their creator, exact source page,
  licence URL and original-byte verification in this document before activation.

The news-writing standard is `DAILY-NEWS-STANDARD.md`. This catalogue changes
no Instagram posts, social posting settings, DNS or database schema.
