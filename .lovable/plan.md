# Add "Wearables vs Safety Apps" Comparison Guide

This resolves the last open SEO finding (Semrush content suggestion) by adding a real, indexable comparison guide page — the one piece of marketing content the scanner flagged as missing.

## What gets built

A new public route `/guide/wearables-vs-apps` (file: `src/routes/guide.wearables-vs-apps.tsx`) — a single, self-contained content page styled with the existing RakshaLink design system (glass cards, `font-display`, semantic tokens like `text-gradient-cyan`, `primary`/`accent`). No new design tokens.

### Page content
- **Hero**: H1 "Safety Wearables vs Safety Apps: Which Protects You Faster?" + intro paragraph.
- **Comparison table**: side-by-side rows comparing a dedicated wearable pendant (RakshaLink) vs phone-only safety apps across: one-tap trigger speed, accessibility when phone is locked/in bag, fall detection, battery independence, discreet activation, GPS accuracy, guardian alerting.
- **3–4 short sections** ("When an app is enough", "Where wearables win", "How RakshaLink combines both") for keyword depth.
- **FAQ section** (3–4 Q&As) targeting long-tail queries.
- **CTA** linking back to `/auth/register`.
- **Back link** to home (`/`).

### SEO wiring (in the route's `head()`)
- Unique `<title>` (<60 chars) and meta description (<160 chars).
- `og:title`, `og:description`, `og:url`, canonical link for the new path.
- JSON-LD: `Article` + `FAQPage` schema.

### Supporting changes
- `src/routes/sitemap[.]xml.ts`: add `{ path: "/guide/wearables-vs-apps", changefreq: "monthly", priority: "0.7" }` to the entries array.
- Add a small text link to the guide from the landing page footer area in `src/routes/index.tsx` (near the demo-build note) so the page is internally linked and crawlable.

## Out of scope
No database, auth, or existing-UI changes. App/guardian functionality untouched.

## Technical notes
- Route is fully public/static (no `beforeLoad` auth, no loader) so it prerenders cleanly and is safe for crawlers.
- After building, mark the SEO finding fixed via the SEO findings tool and offer a re-scan.
