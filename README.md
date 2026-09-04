# Dean's List LTD

Next.js rebuild of deanslist.live with a lead database, admin dashboard, email
campaign system, and AI chatbot.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Server rendering, SEO control, API routes in one app |
| Styling | Tailwind CSS 3 | Fast, consistent design tokens |
| Database | PostgreSQL + Prisma | Typed queries, easy migrations, runs fine on a small VPS |
| Auth | JWT session cookie (jose + bcryptjs) | No external auth service or extra cost |
| Email | Resend | Free tier at launch, simple API, good deliverability |
| Validation | Zod | One schema shared by client and server |

## First run (Windows)

```powershell
cd D:\codes\deanleas
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Then follow the printed steps. Manual equivalent:

```powershell
copy .env.example .env
npm install
npx prisma generate
npm run db:push
npm run db:seed
npm run dev
```

Default seeded admin: `admin@deanslist.live` / `ChangeMe123!`
Change it immediately, or set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before seeding.

## Database

Any PostgreSQL works. Two easy options:

- **Local:** install PostgreSQL 16, create a `deanslist` database, then set
  `DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/deanslist?schema=public"`
- **Cloud free tier:** create a database on Neon or Supabase and paste the connection
  string. Good for development before the VPS is ready.

Useful commands:

```
npm run db:push     # sync schema to the database (development)
npm run db:studio   # visual database browser
npm run db:seed     # create admin user + sample show
```

## Folder structure

```
prisma/
  schema.prisma        Data model: leads, shows, winners, campaigns, chatbot
  seed.ts              First admin user and sample show
src/
  app/
    page.tsx           Homepage
    enter/             Contest entry funnel
    admin/             Protected dashboard
      login/           Sign in
      leads/           Leads and entries table
    api/
      leads/           Lead + contest entry submissions
      subscribe/       Newsletter opt-in
      auth/            Login and logout
  components/
    site/              Header, footer, public UI
    forms/             Entry form and other capture forms
  lib/
    prisma.ts          Database client singleton
    auth.ts            Session create / read / destroy
    mail.ts            Resend wrapper + email templates
    validation.ts      Zod schemas
    rate-limit.ts      Simple abuse protection
  middleware.ts        Protects /admin/*
```

## Build order

- [x] Project setup, data model, lead capture API, admin shell
- [ ] Design system pass (fonts, colors, motion) and homepage sections
- [ ] Remaining public pages: about, shows, winners, watch, sponsors, rules, contact
- [ ] Admin: lead detail view, filters, tags, segments, CSV export
- [ ] Shows and content manager (dynamic pages)
- [ ] Email campaign builder: templates, audience picker, scheduling, send log
- [ ] AI chatbot: three-tab widget, guided flow, knowledge base, transcripts
- [ ] SEO pass, Open Graph images, Event schema, redirects from old Joomla URLs
- [ ] Deploy to Hostinger VPS (KVM 1), DNS cutover, SSL

## Deployment note

The current site cannot host this app, so the target is a Hostinger VPS (KVM 1) running
Node 20+, PostgreSQL, PM2, and Nginx as a reverse proxy with a free Let's Encrypt
certificate. DNS is only pointed at the new server after the build is approved, so the
existing site stays live throughout development.

## Environment variables

See `.env.example`. Nothing is required to boot the UI except `DATABASE_URL` and
`AUTH_SECRET`. Email sending is skipped with a console warning until `RESEND_API_KEY`
is set, so you can build without connecting anything.
