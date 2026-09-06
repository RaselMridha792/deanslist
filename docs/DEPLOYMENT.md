# Deployment

Two targets, and they are not alternatives. Vercel is where the site runs today
and where the client reviews it. The Hostinger VPS is the destination in the
signed scope, and moving there also moves the database off Neon and into
Postgres on the same box.

This document is the runbook for both. It was written before the VPS existed,
so every command here is derived from this repository — the scripts in
`package.json`, the schema in `prisma/`, the variables `src/lib/env.ts`
validates — rather than from a generic Next.js guide. **Sections marked
UNVERIFIED have not been executed against a real server.** Correct them in place
the first time they are run; a runbook that was never corrected is a runbook
nobody has followed.

---

## 1. Environment variables

`src/lib/env.ts` validates these at boot and **refuses to start** on a bad set,
which is deliberate: a site that boots without `AUTH_SECRET` is a site with a
forgeable session cookie.

### Required

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string. On Neon this is the **pooled** URL. |
| `AUTH_SECRET` | 32+ characters in production, and the loader rejects anything containing `change-me` or `dev-only`. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_SITE_URL` | The public origin, no trailing slash. Used for canonical URLs, OG images and the sitemap. Wrong here means wrong in every share preview. |

### Required for a feature, optional for boot

Each of these switches a feature on. Left unset, the feature is **visibly**
disabled in the dashboard rather than silently broken — the campaigns screen
says so in as many words. That is the intended behaviour, not a gap.

| Variable | Switches on | Unset means |
|---|---|---|
| `DIRECT_URL` | Prisma migrations against a pooled Postgres | `migrate deploy` may fail against a pooler |
| `RESEND_API_KEY` | Sending email | Campaigns compose and preview; a send is refused |
| `RESEND_WEBHOOK_SECRET` | Bounce and complaint handling | Hard bounces never reach the suppression list |
| `MAIL_FROM` | The From header | Defaults to `Dean's List <noreply@deanslist.live>` |
| `TEAM_NOTIFY_EMAIL` | Internal notification of a new lead | Nobody is emailed; the row is still stored |
| `ANTHROPIC_API_KEY` | The assistant's free-text answers | The guided capture flow still works; questions fall back to the knowledge base |
| `CHAT_DAILY_TOKEN_CAP` | The assistant's daily spend ceiling | Defaults to 2,000,000 |
| `CRON_SECRET` | The scheduler endpoint | `/api/cron/tick` answers **503**, so scheduled campaigns never fire |
| `CLOUDINARY_URL` | Uploading media with `scripts/upload-media.mjs` | Delivery still works; only the upload script needs it |
| `NEXT_PUBLIC_MEDIA_IMAGE_BASE` / `..._VIDEO_BASE` | Serving media from Cloudinary | Media is served from `/public` |
| `STORAGE_*` (5 vars) | File uploads on the public forms | The upload control renders disabled and says so |

**A note on `CRON_SECRET`.** It fails closed on purpose. An unconfigured
scheduler that returned 200 would look healthy while sending nothing, and an
open one is "send every scheduled campaign now" exposed to the internet.

---

## 2. Vercel (current)

The deployment at `deanslist-one.vercel.app` builds from `main` on push.

### Set the variables

Project → Settings → Environment Variables. Add every variable from section 1
to **Production**, then redeploy — Vercel does not apply new variables to an
existing build.

To check what is actually live rather than what you believe is live, sign in to
`/admin/campaigns`. It names each missing piece.

### The scheduler

`vercel.json` declares a daily cron. Daily and not hourly because the free plan
rejects a more frequent schedule and a rejected cron fails the whole
deployment. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically
once that variable exists, which is the header `/api/cron/tick` expects.

Daily is too coarse for "send at 10am Tuesday", so the real scheduler is
`.github/workflows/scheduler.yml`, every fifteen minutes. It needs two
repository secrets under Settings → Secrets and variables → Actions:

- `CRON_SECRET` — the same value as on the deployment
- `SITE_URL` — the origin, no trailing slash

Running both is safe. `claimNextJob` takes each job with a conditional update
and proceeds only when exactly one row changed, so overlapping ticks cannot
claim the same job.

### Verifying it

```bash
# 503 = CRON_SECRET is not set on the deployment
# 401 = set, but this secret is wrong
# 200 = working
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR-DOMAIN/api/cron/tick
```

---

## 3. Hostinger VPS (KVM 1) — UNVERIFIED

One core and limited RAM. Two things follow from that and both bite before
anything else does.

### 3.1 Swap, before the first build

`next build` on a 1-core KVM box will OOM without it. Do this first.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 3.2 User, SSH and firewall

```bash
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# In /etc/ssh/sshd_config: PasswordAuthentication no, PermitRootLogin no
sudo systemctl restart ssh

sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443
sudo ufw enable && sudo ufw status
```

Confirm the key works in a **second** terminal before closing the first. Locking
yourself out of a fresh box is recoverable; locking yourself out of a running
one is not.

### 3.3 Node and Postgres

Node 20 LTS or newer. Next 15 requires 18.18+; this was developed on 24.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
. ~/.nvm/nvm.sh && nvm install 22 && nvm alias default 22

sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql <<'SQL'
CREATE USER deanslist WITH PASSWORD 'GENERATE-A-REAL-ONE';
CREATE DATABASE deanslist OWNER deanslist;
SQL
```

`DATABASE_URL` becomes
`postgresql://deanslist:PASSWORD@localhost:5432/deanslist?schema=public`, and
`DIRECT_URL` is the same value — there is no pooler in front of a local
Postgres.

### 3.4 Deploy

```bash
git clone https://github.com/RaselMridha792/deanslist.git ~/app && cd ~/app
cp .env.example .env   # then fill it in, per section 1
npm ci                 # postinstall runs prisma generate
npx prisma migrate deploy
npm run build
```

**`migrate deploy`, never `db push`.** `db push` diffs the schema against the
database and applies whatever it decides, which on a database holding real
leads can mean a silent destructive change. `migrate deploy` applies the five
committed migrations in order and nothing else.

Seed only on a genuinely empty database:

```bash
npm run db:seed
```

### 3.5 Migrating the data off Neon

Do this before DNS, not after.

```bash
# On a machine that can reach both
pg_dump --no-owner --no-privileges --format=custom "$NEON_DATABASE_URL" -f neon.dump
pg_restore --no-owner --no-privileges -d "$VPS_DATABASE_URL" neon.dump

# Then confirm the row counts match, rather than assuming
psql "$VPS_DATABASE_URL" -c 'SELECT
  (SELECT count(*) FROM "Lead") AS leads,
  (SELECT count(*) FROM "User") AS users,
  (SELECT count(*) FROM "Winner") AS winners;'
```

**Run `npm run db:purge-test:apply` before the dump.** Otherwise the test rows
the Playwright suite wrote into the shared database migrate along with the real
ones. See section 7.

### 3.6 PM2 — single instance

```bash
npm i -g pm2
pm2 start npm --name deanslist -- run start   # NOT -i max
pm2 save
pm2 startup    # run the command it prints
```

**Not cluster mode.** The rate limiter is in-memory (`src/lib/rate-limit.ts`),
so across workers each process keeps its own counters and the effective limit
becomes the configured one multiplied by the worker count. Login throttling and
form abuse protection both silently weaken. Move to a shared store before ever
scaling out.

### 3.7 Nginx

```nginx
server {
  listen 80;
  server_name deanslist.live www.deanslist.live;

  # 500 MB is the entry form's stated video ceiling. Nginx defaults to 1 MB and
  # rejects anything larger with a 413 before Next.js ever sees it.
  client_max_body_size 500M;

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;

  location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;

    # The app reads the client IP from this for rate limiting. Without it every
    # visitor shares one bucket, which means one bot can lock out the world.
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # A tick that picks up a campaign holds the connection while it sends.
    proxy_read_timeout 300s;
  }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 3.8 TLS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d deanslist.live -d www.deanslist.live
sudo systemctl status certbot.timer      # renewal is a timer, confirm it exists
sudo certbot renew --dry-run
```

### 3.9 The scheduler, on the VPS

GitHub Actions still works and needs no change beyond `SITE_URL`. If you would
rather the box drive itself:

`/etc/systemd/system/deanslist-tick.service`

```ini
[Unit]
Description=Dean's List scheduler tick
[Service]
Type=oneshot
Environment=CRON_SECRET=THE-SECRET
ExecStart=/usr/bin/curl --silent --show-error --fail --max-time 300 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  https://deanslist.live/api/cron/tick
```

`/etc/systemd/system/deanslist-tick.timer`

```ini
[Unit]
Description=Run the Dean's List scheduler every 5 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now deanslist-tick.timer
sudo systemctl list-timers deanslist-tick.timer
```

### 3.10 Backups, with a restore that has been run

A backup nobody has restored is a hope, not a backup.

`/etc/cron.daily/deanslist-backup`, `chmod +x`:

```bash
#!/bin/bash
set -euo pipefail
DEST=/var/backups/deanslist
mkdir -p "$DEST"
pg_dump --no-owner --format=custom deanslist \
  -f "$DEST/deanslist-$(date +%F).dump"
find "$DEST" -name 'deanslist-*.dump' -mtime +14 -delete
```

Restore, tested once into a scratch database and not into production:

```bash
sudo -u postgres createdb restore_test
pg_restore --no-owner -d restore_test /var/backups/deanslist/deanslist-YYYY-MM-DD.dump
psql restore_test -c 'SELECT count(*) FROM "Lead";'
sudo -u postgres dropdb restore_test
```

Get the dumps off the box as well. A backup on the same disk as the database
survives a mistake and nothing else.

---

## 4. Email domain authentication

This gates every bulk send and depends on DNS, so start it before it is needed.

In Resend, add `deanslist.live` and publish the records it gives you:

- **SPF** — a TXT record authorising Resend to send for the domain
- **DKIM** — the CNAME or TXT records Resend generates
- **DMARC** — start at `v=DMARC1; p=none; rua=mailto:...` to collect reports,
  and tighten to `quarantine` once the reports are clean

`MAIL_FROM` must be on the authenticated domain. Sending as
`noreply@deanslist.live` while only a different domain is authenticated is how
a list ends up in spam on its first send, and reputation is much harder to
recover than to establish.

Verify with `dig TXT deanslist.live`, `dig TXT _dmarc.deanslist.live`, and by
sending one real message to a Gmail address and reading **Show original** for
three `PASS` lines.

---

## 5. DNS cutover — client approval first

Everything above can be done while the old site is still live. This step is the
one that is visible to the public.

Before it: section 7's checklist, all of it, on the new server rather than on
Vercel.

1. Lower the TTL on the existing records to 300 seconds, **at least a day
   ahead**. A record cached at 24 hours will keep sending people to the old
   site for a day after the change, and lowering the TTL at cutover time does
   not help — the old TTL is what is already cached.
2. Point the A record at the VPS. Add `www` as a CNAME to the apex.
3. Watch `pm2 logs deanslist` and the Nginx access log for the first hour.
4. Raise the TTL back to 3600 once traffic has settled.

**The blocker as of writing.** The domain is registered through GoDaddy while
the site is on Squarespace, and it is the client's website manager who holds
the controls. See `session.md`, "Hosting". Nothing here can proceed without
either access or that person's cooperation.

---

## 6. Rollback

Vercel: Deployments → the last good one → Promote to Production. Seconds.

VPS:

```bash
cd ~/app
git log --oneline -5
git checkout <last-good-sha>
npm ci && npm run build && pm2 restart deanslist
```

**Database changes do not roll back with the code.** `prisma migrate deploy` is
forward-only. If a release includes a migration, the rollback is: restore the
dump taken before the migration, then deploy the old code. That is why section
3.10 says to take one before every migrating release.

---

## 7. Before handing it to the client

- [ ] `npm run db:purge-test:apply` — the Playwright suite writes leads into
      whatever database it points at, and the dashboard should open at zero
      rather than at a few hundred fixtures
- [ ] The admin password is not the seeded one. Better than changing it after:
      set `SEED_ADMIN_PASSWORD` **before** running the seed, so `ChangeMe123!`
      is never valid on that server at all. It is in the repository and
      therefore public; the Team screen warns while any account still uses it
- [ ] `AUTH_SECRET` is a real 32-byte value, not the development default
- [ ] `NEXT_PUBLIC_SITE_URL` is the live origin — every OG image, canonical URL
      and sitemap entry is built from it
- [ ] `/admin/campaigns` shows no configuration warnings
- [ ] `/api/cron/tick` returns 200 to a correct secret
- [ ] One real submission through each public form appears in the dashboard
- [ ] One real email send lands in an inbox, not in spam
- [ ] `npm run audit:contrast` is clean
- [ ] `npx playwright test` passes against the live origin:
      `BASE_URL=https://deanslist.live npx playwright test`
- [ ] A backup has been taken **and restored** into a scratch database
- [ ] `robots.txt` and `/sitemap.xml` resolve on the live domain
- [ ] The old Joomla URLs redirect — the suite covers every entry in
      `next.config.ts`, so the run above proves it
