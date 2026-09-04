# Project brief

Context for anyone working on this repository. Read this first.

---

## 1. What this project is

A full rebuild of **deanslist.live** for the client **Dean's List LTD** (Charleston, WV, USA).

Dean's List runs a **global online talent competition** broadcast live on YouTube and
Facebook. Two show brands:

- **Crown the Sound** — video entry based, contestants perform an assigned song, audience
  votes, winner takes a $1,000 cash prize and a place on the "Principal's Roll".
- **Drop That Mike** — live weekly show. The prize pool drains in real time while the
  audience votes **Freeze** (lock the pot) or **Pass** (eliminate). Audience participation
  is the whole gimmick.

The old site is Joomla, static, and leaks every lead: the entry form is a third party
MachForm iframe, "Contact Us" links to `#`, most social icons are dead, Open Graph images
are broken, the stats band renders empty numbers, and the homepage names a different
winner than the winners page.

**The business problem we are solving:** they have a large rented social audience
(700K+ subscribers) and own none of it. No email list, no database, no way to re-activate
anyone.

---

## 2. What we are building

1. **Next.js website** — redesigned, high converting, modern luxury/broadcast feel.
2. **Client owned lead database** — every contestant, fan, sponsor, and crew applicant.
3. **Custom admin dashboard** — leads, segments, shows, content, campaigns.
4. **Email campaign system** — one click event announcements and reminders to a chosen
   segment. This is a weekly show, so reminder automation is the highest value feature.
5. **AI chatbot / engagement center** — floating three tab widget (Entry Form, Guided Chat,
   Direct Info), modelled on the pattern used on alabamaoutsidecounsel.com.

---

## 3. Stack and commands

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript, `src/` dir, `@/*` alias |
| Styling | Tailwind CSS 3 (config in `tailwind.config.ts`) |
| Database | PostgreSQL via Prisma |
| Auth | JWT session cookie, `jose` + `bcryptjs`, guarded in `src/middleware.ts` |
| Email | Resend (free tier) |
| Validation | Zod, schemas in `src/lib/validation.ts` |

```bash
npm run dev        # dev server
npm run build      # prisma generate + next build
npm run db:push    # sync schema to database
npm run db:studio  # browse data
npm run db:seed    # first admin user + sample show
```

Node 20+ required. Environment variables are documented in `.env.example`.

---

## 4. Current state

Already built and working:

- Prisma schema covering User, Show, Episode, Winner, Lead, Tag, TagOnLead, Campaign,
  CampaignSend, Conversation, Message, KnowledgeItem
- `POST /api/leads` — validation, honeypot, rate limit, DB write, confirmation email to the
  submitter, notification email to the team
- `POST /api/subscribe` — newsletter opt-in with duplicate handling
- `POST /api/auth/login` and `/api/auth/logout`
- `/enter` page with a working contestant entry form
- `/admin` shell: middleware protection, login page, overview counters, leads table
- Site header, footer, base design tokens, homepage skeleton

**Not built yet:** everything in section 6.

---

## 5. Conventions to follow

**Code**

- Server Components by default. Add `"use client"` only when state, effects, or event
  handlers are actually needed.
- All user input validated with a Zod schema in `src/lib/validation.ts`. Never trust the
  client.
- Database access only through `@/lib/prisma`. Never instantiate `PrismaClient` again.
- Every public POST route gets `rateLimit()` and a honeypot field.
- Emails only through `@/lib/mail`. It no-ops safely when `RESEND_API_KEY` is missing, so
  never add a hard dependency on the key at build time.
- Keep pages thin. Data fetching in the page or a `lib/queries` helper, presentation in
  components.
- Reuse the design tokens: `.shell`, `.btn-primary`, `.btn-ghost`, `.field`, `.label`, and
  the `ink` / `gold` / `brandred` colors. Do not introduce new one-off hex values.

**Design direction**

- Dark, cinematic, premium. Deep near-black base, restrained gold accent, red used sparingly
  for urgency only.
- Big display type for headings, generous spacing, high contrast.
- One primary call to action per page. Entry is always the primary action on the public site.
- Mobile first. The audience arrives from Facebook and YouTube on phones.

**Content rules**

- Never invent contest facts (dates, prize amounts, winner names, subscriber counts). If a
  real value is missing, use an obvious placeholder and add it to the open questions list at
  the bottom of this file.
- Known data conflicts in the old site that must NOT be copied over: the homepage and the
  winners page name different winners, and the event date appears as both August 11 and
  August 28. These need client confirmation.

**Guardrails**

- Never commit `.env`. Only `.env.example` is tracked.
- Schema changes: edit `prisma/schema.prisma`, then run `npm run db:push` in development.
  Do not hand-write SQL migrations.
- Do not add a dependency without a clear reason. Every new package is a maintenance and
  security cost on a small VPS.
- Do not add analytics, chat widgets, or third party embeds that were not agreed in scope.

---

## 6. Build order

Work top to bottom. Finish and verify one item before starting the next.

1. **Design system pass** — fonts loaded via `next/font`, final color and type scale,
   button and card variants, section spacing rhythm.
2. **Homepage sections** — hero with current show and countdown, show explainer, latest
   winner spotlight, video highlights, stats band, gallery, sponsor strip, newsletter
   capture.
3. **Public pages** — `/about`, `/shows`, `/shows/[slug]`, `/winners`, `/winners/[slug]`,
   `/watch`, `/join` (crew and judges), `/sponsors`, `/rules`, `/contact`, `/thank-you`.
   All dynamic content reads from the database.
4. **Admin: leads** — detail drawer, status changes, internal notes, filters (type, status,
   show, country, date), search, tags, CSV export.
5. **Admin: content** — CRUD for shows, episodes, winners, gallery, and homepage stat
   values.
6. **Email campaigns** — template library, audience picker built on saved filters,
   personalization tokens, preview, send now and schedule, per campaign send log, and an
   unsubscribe route with a stored consent record.
7. **AI chatbot** — floating widget with three tabs, guided step flow that captures contact
   details as it goes, answers restricted to the `KnowledgeItem` knowledge base, saves the
   conversation and creates a Lead with `source: CHATBOT`.
8. **SEO and launch prep** — per page metadata, working Open Graph images, `Event` structured
   data for shows, sitemap, robots, and a redirect map from the old `/index.php/...` Joomla
   URLs.
9. **Deployment** — Hostinger VPS (KVM 1): Node 20, PostgreSQL, PM2, Nginx reverse proxy,
   Let's Encrypt SSL. DNS is only switched after client approval, so the old site stays live
   until then.

---

## 7. Definition of done for any task

- TypeScript compiles with no errors, `npm run build` passes.
- Works on mobile (360px), tablet, and desktop. No overflow, no clipped text.
- Forms show clear loading, success, and error states.
- No hardcoded content that should live in the database.
- No secrets in the code.

---

## 8. Open questions for the client

Add to this list rather than guessing.

- Confirmed winner name and details for the first Crown the Sound season (the old site
  contradicts itself).
- Real current subscriber and follower counts for the stats band.
- Next show date, entry deadline, and prize amount.
- Official contest rules, eligibility, and prize terms wording.
- Sponsorship package tiers, if the sponsors page ships at launch.
- Whether entries accept file uploads or video links only.
