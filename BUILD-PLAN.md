# BUILD-PLAN.md

Task breakdown for Claude Code. Each task is scoped to be finishable and verifiable on its
own. Do them in order. After each task, run `npm run build` and fix anything it reports
before moving on.

> Recon evidence behind this plan lives in `docs/SITE-AUDIT.md`. Content pulled from the old
> site lives in `docs/CONTENT-INVENTORY.md`. Open client questions are in `CLAUDE.md` §8.

---

## Phase 0 — Foundation and asset pipeline

Nothing else is safe to build until this is done.

**0.1 Version control**
`git init`, commit the current tree. `.gitignore` already covers `.env`, `.next`,
`node_modules`. No further work happens on an untracked codebase.

**0.2 Environment safety**
`src/lib/env.ts` — validate required env vars with Zod at module load. `AUTH_SECRET` must
throw in production rather than falling back to a dev string. Remove the
`?? "dev-only-insecure-secret"` fallback in `src/middleware.ts` and `src/lib/auth.ts`.
Extend `.env.example` with the keys later phases need: `OPENAI_API_KEY` (or equivalent),
`CRON_SECRET`, `UPLOAD_*` / S3-compatible storage, `RESEND_WEBHOOK_SECRET`.

**0.3 Asset harvest**
`scripts/harvest-assets.mjs` — pull every image and video off the old site into
`assets/raw/`. Already inventoried: 15 images (13 MB) and 17 videos (96 MB).

**0.4 Image optimisation**
`scripts/optimize-images.mjs` using `sharp`. The old site ships 3.7 MB PNGs. Convert to
WebP + AVIF, cap the long edge at 2000px, emit into `public/media/`. Target: the whole
image set under 1.5 MB.

**0.5 Video transcode**
`scripts/transcode-video.mjs` using `ffmpeg-static` (ffmpeg is not on this machine).
**12 of the 17 videos are `.mov` / `video/quicktime` and do not play in Chrome, Firefox, or
Edge at all** — they are downloaded and discarded. Transcode every one to H.264 MP4 +
VP9 WebM, extract a JPEG poster frame at 1s, cap height at 1080. Target: hero video under
2 MB, poster under 120 KB.

Done when: `public/media/` holds web-safe, optimised assets and the raw originals are
gitignored.

---

## Phase 1 — Schema completion

The current schema cannot support Phases 3, 5, 6, or 7. Add every missing model in one pass
so no later phase blocks on a migration.

Add to `prisma/schema.prisma`:

| Model | Needed by |
|---|---|
| `Sponsor` | Phase 3 SponsorStrip, Phase 4 `/sponsors` |
| `GalleryImage` | Phase 6 content manager |
| `SiteStat` | Phase 3 StatsBand — values must come from the DB, never hardcoded |
| `PageSection` | Content Manager, per the signed scope |
| `Segment` | Phase 7 saved reusable audiences (`Campaign.audience` JSON is not enough) |
| `Asset` | uploads, if the client wants file entries |
| `AuditLog` | RBAC accountability |
| `EmailEvent` | Resend webhooks: bounce, complaint, open, click |
| `Suppression` | hard bounces and complaints must never be mailed again |

Also: add `unsubscribeToken` + `unsubscribedAt` to `Lead`; give `Conversation.leadId` a real
relation to `Lead` (it is currently a dangling `String`); add indexes on the columns the
dashboard actually filters by (`Lead.country`, `Lead.showId`, `Lead.source`).

Then baseline migrations: `prisma migrate dev --name init`. **From this point on, schema
changes ship as migrations, not `db:push`** — Phase 10 deploys with `migrate deploy`.

Done when: `npx prisma migrate dev` runs clean and `prisma/migrations/` is committed.

---

## Phase 2 — Design system

**2.1 Fonts**
Load display + body via `next/font/google`, wired to the `--font-display` / `--font-body`
variables already referenced in `globals.css` (currently hardcoded strings that silently
fall back). Display face must carry the broadcast feel at 96px+; body must stay legible at
14px on a phone.

**2.2 Token pass**
Refine `tailwind.config.ts` and `globals.css`. Gold must read as *metal*, not yellow — that
means gradient stops and a specular band, never a flat fill. Add: surface elevation ramp,
focus-ring color, `.card`, section padding scale, `.eyebrow` for the small uppercase labels.
Red is reserved for urgency (countdown, deadline, live badge) and nothing else.

**2.3 UI primitives**
`src/components/ui/`: `Button`, `Card`, `SectionHeading`, `Badge`, `Countdown` (client
component, target date in, days/hours/minutes out, hides itself once passed and never
renders a negative or a hydration-mismatched value).

Done when: a scratch page composes from primitives without writing new CSS.

---

## Phase 3 — Homepage

Each section its own component in `src/components/home/`, composed in `src/app/page.tsx`.
Data from the database with sensible empty states.

- `Hero` — current OPEN or LIVE show, tagline, `Countdown` to `entryDeadline`, primary
  "Enter the contest" CTA, secondary "Watch", transcoded background video with poster frame
  and dark overlay. Falls back to a still on save-data or slow connections.
- `ShowExplainer` — enter, perform, get voted, win.
- `WinnerSpotlight` — most recent `Winner`, photo, prize, link to detail.
- `VideoHighlights` — `Episode` grid. Thumbnail only; the iframe mounts on click. Never
  auto-embed multiple players.
- `StatsBand` — from `SiteStat`. **Never render a partial number** — the old site shows
  `.7Mil+` and a bare `K`, which is the single most visible bug on it today.
- `SponsorStrip` — hidden entirely when there are no sponsors.
- `NewsletterCTA` — posts to `/api/subscribe`, real success state.

Done when: no placeholder copy remains except where a client answer is pending, and mobile
LCP stays under 2.5s with the hero video in place.

---

## Phase 4 — Public pages

Shared `PageHero` for consistency. Every dynamic route gets `generateMetadata`.

| Route | Notes |
|---|---|
| `/about` | Brand story, format, Principal's Roll, credibility |
| `/shows` | Shows from the DB, grouped by status |
| `/shows/[slug]` | Format, Freeze/Pass mechanic, prize, schedule, episodes, entry CTA |
| `/winners` | Archive, newest first |
| `/winners/[slug]` | Profile, prize, performance embed, story |
| `/watch` | Episode library, filterable by show |
| `/join` | Crew, judge, host applications → `/api/leads` `type: CREW` |
| `/sponsors` | Reach, tiers, inquiry form → `type: SPONSOR` |
| `/rules` | Client-supplied. Ships as a placeholder that says so, never invented |
| `/contact` | Routed inquiry types (general, press, sponsorship, support) + direct details |
| `/thank-you` | Confirmation, expectation setting, social follow |
| `/privacy` + `/terms` | Required for email compliance and ESP approval. Not in the original plan |

Done when: nothing in the header or footer 404s, and every form writes with the correct
`type`. **The old site has 42 dead `href="#"` links — zero is the target.**

---

## Phase 5 — Admin: leads

**5.1 Filters and search** on `/admin/leads`: type, status, show, country, date range, text
search across name and email. URL search params so views are shareable.

**5.2 Lead detail** `/admin/leads/[id]`: all fields, performance video embedded when the
link is YouTube or Facebook, status selector, internal notes, tags editor. Saves via server
actions.

**5.3 Tags** — create, assign, remove. Chips in the table.

**5.4 Export** — `GET /api/admin/leads/export` honouring current filters. **CSV *and* XLSX**;
the signed scope promises both. Admin session required.

**5.5 Bulk actions** — select rows, bulk status change, bulk tag.

**5.6 Route protection** — every `/api/admin/*` route re-checks the session server-side.
Middleware alone protects pages, not API routes. Add `requireRole()` and use it everywhere.

Done when: the team finds any lead in under three clicks and exports a filtered list.

---

## Phase 6 — Admin: content

CRUD for `Show`, `Episode`, `Winner`, `Sponsor`, `GalleryImage`, and `SiteStat`. Zod
validated, server actions, revalidated UI after save.

RBAC enforced in code, not just declared: `REVIEWER` reads and changes lead status only,
`EDITOR` manages content, `OWNER` does everything including user management. Add
`/admin/team` for user CRUD — the signed scope lists a "Team & Roles" module and the
original plan had no screen for it.

Every mutation writes an `AuditLog` row.

Done when: the client publishes a new show and a new winner without a developer.

---

## Phase 7 — Email campaigns

**7.1 Templates** — `src/lib/email-templates/`: announcement, reminder, entry deadline,
results, winner spotlight. Table-based, inline styles, dark branded.

**7.2 Personalization** — `{{firstName}}`, `{{showTitle}}`, `{{showDate}}`,
`{{prizeAmount}}`, `{{entryLink}}`, `{{unsubscribeLink}}`.

**7.3 Audience picker** — reuse the Phase 5 filter shape. Saveable as a named `Segment`.
Live recipient count before sending.

**7.4 Composer** — `/admin/campaigns/new`: name, subject, preheader, template, audience,
body, preview with sample data, send-test-to-one-address.

**7.5 Sending** — create `CampaignSend` rows first, then batch with a delay to respect rate
limits. Never block the request. Store the provider id per row.

**7.6 Job runner** — **this was missing from the original plan entirely.** `Campaign.
scheduledFor` exists but nothing executes it, and the same gap kills the automated pre-show
reminders that `CLAUDE.md` §2 calls the highest-value feature. Implement a DB-backed job
table plus a `GET /api/cron/tick` endpoint guarded by `CRON_SECRET`, driven by systemd timer
or PM2 cron on the VPS. Handles: scheduled sends, pre-show reminder sequences, retries.

**7.7 Unsubscribe** — signed token, `/unsubscribe/[token]`, clears `marketingOptIn`, records
the timestamp, writes a `Suppression` row. `List-Unsubscribe` and
`List-Unsubscribe-Post` headers on every campaign send.

**7.8 Delivery events** — **also missing from the original plan.** `POST /api/webhooks/resend`
(signature verified) writing `EmailEvent` rows for delivered, bounced, complained, opened,
clicked. Hard bounces and complaints auto-suppress. The signed scope promises open and
click reporting; without this it cannot be delivered.

**7.9 Reporting** — per campaign: sent, failed, delivered, opened, clicked, plus the
recipient list with per-row status.

Done when: the team announces the next episode to a segment in under two minutes, a
scheduled send fires unattended, and every send is logged.

---

## Phase 8 — AI chatbot

**8.1 Widget shell** — floating launcher, bottom right, every public page. Three tabs:
**Entry Form**, **Guided Chat**, **Direct Info**. Full-width sheet on mobile.

**8.2 Entry Form tab** — compact entry form → `/api/leads`, `source: WEBSITE_FORM`.

**8.3 Guided Chat tab** — stepped flow with a visible progress indicator: intent
(contestant / fan / sponsor / support) → name → email → intent-specific detail → confirm.
Persist `Conversation` + each `Message`. Create a `Lead` with `source: CHATBOT` the moment
an email is captured, so abandoned conversations still yield usable data.

**8.4 Answers** — grounded strictly in active `KnowledgeItem` rows passed as context. No
match means saying so and offering a handoff. **Never let the model state a date, prize,
deadline, or eligibility rule that is not in the knowledge base** — these are legally loaded
facts.

**8.5 Abuse and cost controls** — the chat endpoint is public and unauthenticated, which
makes it a wallet-drain vector. Per-IP and per-session rate limits, a max token cap per
reply, a daily spend ceiling, and prompt-injection resistant system framing.

**8.6 Admin console** — `/admin/chatbot`: transcripts with intent and captured lead, plus
CRUD over the knowledge base.

Done when: a visitor enters the contest without leaving the page, and the team changes what
the bot knows without a deploy.

---

## Phase 9 — SEO and launch prep

- `generateMetadata` on every route with real titles and descriptions.
- **A real Open Graph image.** `public/` is currently empty while `layout.tsx` points at
  `/og.jpg` — the new site today has the exact bug the old one is criticised for. The old
  site's `og:image` is literally `https://deanslist.live/`, which is why previews never
  render. Generate per-show and per-winner cards with `next/og`.
- `Event` JSON-LD on show pages, `Person` on winner pages.
- `sitemap.ts` and `robots.ts`.
- **Redirect map — confirmed against the old sitemap, not guessed:**

  | Old | New |
  |---|---|
  | `/index.php` | `/` |
  | `/index.php/what-is-the-deans-list` | `/about` |
  | `/index.php/join-the-dean-team` | `/join` |
  | `/index.php/upcoming-events/deans-list-drop-that-mike-challenge` | `/shows/drop-that-mike` |
  | `/index.php/past-challenges/1st-crown-the-sound-winner` | `/winners/[slug]` |
  | `/index.php/videos` | `/watch` |
  | `www.deanslist.live/*` | apex, 301 |

- Accessibility pass: focus states, alt text, contrast, keyboard nav on the widget and forms.
- Smoke tests — a project whose entire value is "every form reaches the client's database"
  cannot ship without a test that proves each form still writes. Playwright over the four
  public forms plus admin login.

---

## Phase 10 — Deployment (Hostinger VPS, KVM 1)

1. Ubuntu 24.04, non-root sudo user, SSH key auth, UFW allowing 22, 80, 443 only.
2. Node 20+ LTS via nvm, PostgreSQL 16, dedicated database and user.
3. Swap file before the first `next build` — a 1-core KVM box will OOM mid-build otherwise.
4. Clone, set `.env`, `npm ci`, `npx prisma migrate deploy`, `npm run build`.
5. PM2 on port 3000, saved, enabled on boot. **Single instance, not cluster mode** — the
   rate limiter is in-memory and silently breaks across workers. Switch to a shared store
   before ever scaling out.
6. Nginx reverse proxy, gzip, static caching headers, `client_max_body_size` sized for
   uploads.
7. Certbot for Let's Encrypt and auto-renewal.
8. systemd timer hitting `/api/cron/tick` with `CRON_SECRET` (Phase 7.6).
9. Nightly `pg_dump` to a separate location, with a tested restore command.
10. Email domain auth — SPF, DKIM, DMARC on the sending domain, verified before any bulk
    send. This gates the campaign system and depends on DNS access, so start it early.
11. Only after client approval: point the DNS A record at the VPS.

Write it up in `docs/DEPLOYMENT.md` as you go, with the exact commands used.
