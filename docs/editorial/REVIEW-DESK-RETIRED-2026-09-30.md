# Review desk retired — 30 September 2026

Owner instruction: “destroy the review desk”. This supersedes instructions that require browser review-desk sign-in for news publication.

Removed the review UI. Its draft, reservation, edit/delete, media approval, publication, deployment and receipt APIs now return HTTP 410 without reading credentials, stored records or provider APIs. The dependent correction-staging, automatic draft and watchdog routes are retired too. Proxy protection and route-level tombstones both apply.

Published news, feeds, sitemaps, images, the separate internal dashboard, stored drafts, approval history and credentials remain unchanged. No Production data/schema changes. Source and prior workflow are recoverable from Git. Do not reactivate the GitHub/Vercel automatic publisher.

Editorial work continues in chat. Future manual content releases must use authenticated repository/deployment access, reviewed source and media records, a clean build and exact live verification. Removing this desk does not authorise a public write endpoint or fabricated publication receipts. No replacement publishing system is introduced by this change.

The approved Aldar sample and five additional drafts remain on D: under manual-news-20260930. This retirement is not a claim that those articles are published.
