# Daily news standard

Raj's direction, confirmed 10 September 2026: publish timely, well-framed news
updates. Do not turn every announcement into a research report.

## What a good update contains

- A fresh development that matters to Dubai or UAE real estate. Check the
  event date as well as the article's publication date.
- A clear headline and original UK-English copy. Report the facts in our own
  structure; do not copy the source or merely swap a few words.
- The essential details, with plans attributed to the company or speaker.
  Planned spending is not completed spending; an announcement is not delivery.
- A useful local angle when the source supports one. Do not add generic
  investment advice, invented implications or an obligatory "why it matters"
  paragraph.
- A relevant, high-quality photograph with its source and credit recorded.
  Use an exact approved asset or authorised source image. A city-context image
  must not be presented as the named development.
- A source link that lets the reader check the original reporting.

Length follows the story. The short-update format allows 80–500 words, but that
range is not a target to fill. A brief announcement may need only a few
paragraphs. No repeated summaries, forced FAQs, jargon, sales claims or padded
conclusions. Longer analysis belongs in a separate format.

The Prestige One investment-plan update is the model: a clear account of the
company's plans, attributed to WAM, with an approved Dubai skyline photograph.
Its success does not authorise reusing another publisher's copy or photograph.

## Publish promptly, check the essentials

Read the source, confirm the names, dates and material figures, remove duplicate
coverage, then publish when the copy and image are ready. A concise story should
not wait for unnecessary expansion. Keep the existing source, image and
publication checks; fix false positives rather than bypassing them.

The routine runs in the Dubai morning, with the existing recovery window, and
publishes at most one passing article per scheduled run. Do not invent a story
or change its date to make the feed appear current. If nothing passes, report
the actual hold or failure and what needs attention.

## Test and verify

For a normal discovery-to-staging test, dispatch `news-cron.yml` with
`research_only=true`. Leave `candidate_key=auto`, `curated_candidate_key=none`,
`publication_only=false` and `morning_date` empty. Conflicting selections fail
before research. The mode can call the model and write private drafts but sets
`AUTO_APPROVE=0`; it cannot approve or publish them. It does not occupy the
automated Dubai-day publication slot. The existing bounded
`retry_failed_research` option is only for a confirmed repair.

A staged draft is not a published article. A publication is complete only after
its exact live page is verified and the homepage feed, RSS and sitemaps expose
it. Keep social posting and third-party distribution off unless separately
authorised.
