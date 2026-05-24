# Plan: Generate Complete Project Documentation PDF

Create a single PDF artifact (`/mnt/documents/RakshaLink_Documentation.pdf`) covering the entire RakshaLink app — purpose, features, architecture, screens, database, and tech stack — using ReportLab.

## Scope

This is a one-off artifact generation task. No app code will change. The PDF will be saved to `/mnt/documents/` and delivered via a `<presentation-artifact>` tag.

## PDF Sections

1. **Cover Page** — App name (RakshaLink), tagline, "IoT Safety Network", date
2. **Executive Summary** — What the app does in 1 paragraph (wearable pendant SOS, live GPS, guardian alerts)
3. **Key Features** — Instant SOS, Live tracking, BLE pendant, Fall detection, Guardian alerts, Safe zones
4. **User Roles** — Wearer (app user) vs Guardian (monitors wearer)
5. **Screens / Routes** — Walkthrough of each page:
   - Landing, Auth (login/register)
   - Wearer: Home, Map, SOS, Contacts, Zones, Device, History, Settings
   - Guardian: Index, Map, Alerts, Wearer detail, Zones detail
6. **Database Schema** — All 9 tables (profiles, devices, emergency_contacts, emergency_alerts, guardian_links, live_locations, safe_zones, zone_events, user_preferences) with column descriptions
7. **Technical Architecture** — TanStack Start, React 19, Tailwind v4, Lovable Cloud (Supabase), Google Maps Places integration, BLE simulation
8. **Safety Logic** — How SOS triggers alerts, how safe zones save battery (30s vs 10s polling), fall detection
9. **Design System** — Dark theme, color tokens, glass effect, typography
10. **Demo Limitations** — Pendant hardware and SMS gateway are simulated

## Implementation Steps

1. Explore remaining route files briefly to make section 5 accurate (already have file list).
2. Query each table's columns via `psql \d` for accurate schema section.
3. Write a single Python script using ReportLab Platypus (SimpleDocTemplate, Paragraph, Table, PageBreak) with branded styling (red/cyan accents matching the app).
4. Run script → produces PDF.
5. QA: convert PDF pages to images with `pdftoppm` and visually inspect every page for overflow, clipping, or layout issues. Fix and re-render if needed.
6. Deliver via `<presentation-artifact path="RakshaLink_Documentation.pdf" mime_type="application/pdf">`.

## Out of Scope

- No changes to app source code
- No new routes, components, or database changes
- Not a marketing brochure — this is a technical + product reference document

Estimated output: ~10–15 page PDF.
