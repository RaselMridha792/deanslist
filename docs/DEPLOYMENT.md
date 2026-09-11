# Deployment

Two targets. Vercel is where the site runs today and where the client reviewed
it. The Hostinger VPS is where it is moving, in Docker, with the database moved
off Neon into Postgres on the same box and every image, clip and upload served
from that box's own disk.

Every command here comes from this repository (`Dockerfile`,
`docker-compose.yml`, `Caddyfile`, `.env.docker.example`, the variables
`src/lib/env.ts` validates). It does not come from a generic guide. **Sections
marked UNVERIFIED have not been run against the real server yet.** Correct them
in place the first time they are run. A runbook nobody has corrected is a
runbook nobody has followed.

---

## 1. Environment variables

`src/lib/env.ts` validates these at boot and **refuses to start** on a bad set.
In Docker that is a container that exits with the bad variable named on the
last line of `docker compose logs app`, rather than a server that starts and
fails on its first visitor.

### Required

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string. On Neon this is the **pooled** URL. In Docker it is built by `docker-compose.yml` from the `POSTGRES_*` values, so do not write it in `.env` there. |
| `AUTH_SECRET` | 32+ characters in production. The loader rejects anything containing `change-me` or `dev-only`. Generate: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | The public origin, no trailing slash. Canonical URLs, OG images and the sitemap are built from it, so a wrong value shows up in every share preview. |

### Required for a feature, optional for boot

Each of these switches a feature on. Left unset, the feature is **visibly**
disabled in the dashboard rather than silently broken.

| Variable | Switches on | Unset means |
|---|---|---|
| `DIRECT_URL` | Prisma migrations against a pooled Postgres | `migrate deploy` may fail against a pooler. In Docker it is built for you. |
| `RESEND_API_KEY` | Sending email | Campaigns compose and preview; a send is refused |
| `RESEND_WEBHOOK_SECRET` | Bounce and complaint handling | Hard bounces never reach the suppression list |
| `MAIL_FROM` | The From header | Defaults to `Dean's List <noreply@deanslist.live>` |
| `TEAM_NOTIFY_EMAIL` | Internal notification of a new lead | Nobody is emailed; the row is still stored |
| `ANTHROPIC_API_KEY` | The assistant's free-text answers | The guided capture flow still works; questions fall back to the knowledge base |
| `CHAT_DAILY_TOKEN_CAP` | The assistant's daily spend ceiling | Defaults to 2,000,000 |
| `CRON_SECRET` | The scheduler | `/api/cron/tick` answers **503**, and in Docker the scheduler container idles and says so |
| `UPLOAD_DIR` | Where dashboard uploads are written | `./uploads` beside the app. The Docker image sets `/app/uploads` itself. |
| `NEXT_PUBLIC_MEDIA_IMAGE_BASE` / `..._VIDEO_BASE` | Serving `/public/media` from a CDN instead | Media is served by this server. **Leave empty on the VPS.** |
| `CLOUDINARY_URL` | `scripts/upload-media.mjs` only | Nothing. The site never reads it. |

**A note on `CRON_SECRET`.** It fails closed on purpose. An unconfigured
scheduler that returned 200 would look healthy while sending nothing, and an
open one would let anyone on the internet trigger every scheduled campaign.

---

## 2. Vercel (current)

The deployment at `deanslist-one.vercel.app` builds from `main` on push.

### Set the variables

Project → Settings → Environment Variables. Add every variable from section 1
to **Production**, then redeploy. Vercel does not apply new variables to an
existing build.

To check what is actually live, rather than what you believe is live, sign in to
`/admin/campaigns`. It names each missing piece.

### The scheduler

`vercel.json` declares a daily cron. It is daily and not hourly because the free
plan rejects a more frequent schedule, and a rejected cron fails the whole
deployment. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically
once that variable exists, which is the header `/api/cron/tick` expects.

Daily is too coarse for "send at 10am Tuesday", so the real scheduler is
`.github/workflows/scheduler.yml`, every fifteen minutes. It needs two
repository secrets under Settings → Secrets and variables → Actions:

- `CRON_SECRET`: the same value as on the deployment
- `SITE_URL`: the origin, no trailing slash

Running both is safe. `claimNextJob` takes each job with a conditional update
and proceeds only when exactly one row changed, so overlapping ticks cannot
claim the same job.

---

## 3. Hostinger VPS (KVM 1), Docker — UNVERIFIED

### 3.0 What runs, and where the image comes from

The server never builds anything. `.github/workflows/docker.yml` builds the
image on every push to `main`. It then tests it against a real Postgres:

- migrations apply to an empty database;
- the container refuses to start without `AUTH_SECRET`;
- every public page answers 200;
- media and uploads are served;
- the Caddyfile and compose file validate.

Only then does it push the image to `ghcr.io/raselmridha792/deanslist`. A
one-core VPS can build the image, but slowly and only with swap. A build that
runs out of memory halfway leaves the site on whatever was there before.

`docker compose up -d` on the server starts six containers:

| Service | Does | Persistent state |
|---|---|---|
| `db` | Postgres **18**, the same major version as Neon | volume `deanslist_db-data` |
| `migrate` | `prisma migrate deploy`, then exits. `app` waits for it. | none |
| `app` | The Next.js server, as a non-root user | volume `deanslist_uploads` |
| `caddy` | TLS (Let's Encrypt, automatic), compression, `/uploads` from disk, proxy to `app` | volumes `deanslist_caddy-data` and `caddy-config` |
| `scheduler` | Calls `/api/cron/tick` every five minutes | none |
| `backup` | A daily `pg_dump` and uploads archive into `./backups`, 14 days kept | `./backups` on the host |

Only Caddy publishes ports (80 and 443). The database has no published port at
all, so a firewall mistake cannot expose it.

### 3.1 Swap

Postgres, Node and Caddy fit in 4 GB with room to spare, and no build runs
here. Swap is still cheap insurance against a memory spike taking the database
down with it.

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 3.2 User, SSH and firewall

Log in with an SSH key, never a password. Add the public key in the Hostinger
panel (VPS → Settings → SSH keys) before the first login.

```bash
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# In /etc/ssh/sshd_config: PasswordAuthentication no, PermitRootLogin no
sudo systemctl restart ssh

sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw allow 443/udp
sudo ufw enable && sudo ufw status
```

Confirm the key works in a **second** terminal before closing the first.

A Docker caveat worth knowing: ports a container publishes are opened by
Docker's own firewall rules, **around** ufw. That is harmless here, because
the only published ports are 80 and 443 on Caddy, which are meant to be public.
It is the reason the database publishes none.

### 3.3 Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy     # log out and back in for it to apply
docker version && docker compose version
```

### 3.4 Pulling the image

GHCR packages start private even when the repository is public. Pick one:

- **Make the package public.** GitHub → the repository → Packages →
  `deanslist` → Package settings → Change visibility → Public. The image holds
  no secrets (see the `Dockerfile` header), so nothing in it needs protecting.
  With this option the server needs no credentials.
- **Keep it private** and log the server in once, with a token that has only
  `read:packages`:
  `echo "$TOKEN" | docker login ghcr.io -u RaselMridha792 --password-stdin`

### 3.5 The files on the server

The server needs three files, not the repository:

```bash
mkdir -p ~/deanslist && cd ~/deanslist
for f in docker-compose.yml Caddyfile .env.docker.example; do
  curl -fsSLO "https://raw.githubusercontent.com/RaselMridha792/deanslist/main/$f"
done
cp .env.docker.example .env && chmod 600 .env
```

Fill in `.env`. Generate every secret with `openssl rand -hex 32`. Use **hex
only** for `POSTGRES_PASSWORD`, because a `/`, `@` or `:` would break the
database URL that compose builds from it. Set `SEED_ADMIN_PASSWORD` even if you
never seed, so the value in the repository is never valid here.

For a first look before DNS points at the server, set `SITE_ADDRESS=:80` and
browse to the server's IP over plain http. Put the real names back before
cutover, and Caddy fetches the certificates by itself on the next start.

### 3.6 Moving the data off Neon (before the first full start)

Do this before DNS changes, and before `docker compose up -d` brings up
`migrate`. Restoring into an empty database is simple. Restoring on top of
tables `migrate` has already created is not.

1. **Purge the test data first**, from a development machine whose `.env`
   points at Neon: `npm run db:purge-test` (dry run), then
   `npm run db:purge-test:apply`. Otherwise the Playwright fixtures move
   across with the real rows.
2. On the server:

```bash
cd ~/deanslist
docker compose up -d db          # the database alone

# Neon's DIRECT (unpooled) connection string: the host without "-pooler".
# The client is Postgres 18 because pg_dump refuses to dump a newer server.
docker run --rm -v "$PWD:/work" postgres:18-alpine \
  pg_dump --no-owner --no-privileges --format=custom \
  -d "postgresql://USER:PASSWORD@HOST/DB?sslmode=require" -f /work/neon.dump

docker compose exec -T db pg_restore --no-owner --no-privileges \
  -U deanslist -d deanslist < neon.dump

# Compare with the same query run against Neon. Do not assume they match.
docker compose exec db psql -U deanslist -c 'SELECT
  (SELECT count(*) FROM "Lead") AS leads,
  (SELECT count(*) FROM "User") AS users,
  (SELECT count(*) FROM "Promotion") AS campaigns,
  (SELECT count(*) FROM "Winner") AS winners;'

docker compose up -d             # everything; migrate finds nothing to apply
rm neon.dump                     # it holds every contact record
```

The dump carries `_prisma_migrations`, so `migrate` recognises the schema as
current and applies nothing.

**A fresh database instead** (no Neon data): `docker compose up -d` creates the
schema. The seed script needs `tsx`, which the production image does not ship,
so run it from a checkout on the same Docker network:

```bash
git clone https://github.com/RaselMridha792/deanslist.git ~/src
set -a && . ~/deanslist/.env && set +a     # for $POSTGRES_PASSWORD below
docker run --rm --network deanslist_default -v ~/src:/src -w /src \
  --env-file ~/deanslist/.env \
  -e DATABASE_URL="postgresql://deanslist:$POSTGRES_PASSWORD@db:5432/deanslist?schema=public" \
  node:22-bookworm-slim sh -c 'npm ci && npx tsx prisma/seed.ts'
```

### 3.7 Checking it

```bash
docker compose ps                      # app "healthy", migrate "exited (0)"
docker compose logs --tail=50 app
docker compose logs --tail=20 caddy    # certificate obtained, or why not
curl -fsS https://deanslist.live/api/health    # {"ok":true,"db":"up"}
```

### 3.8 Media and uploads

- **Site media** (`/public/media`: photos in `.avif`, `.webp` and `.jpg`, clips
  in `.webm` and `.mp4`) is inside the image, and the app serves it. There is
  no Cloudinary account to keep. `docs/CLOUDINARY-SETUP.md` is kept only for
  anyone who wants a CDN back later.
- **Dashboard uploads** (campaign posters, winner portraits, show key art,
  sponsor logos) are written to the `uploads` volume. Caddy serves them from
  disk at `/uploads/...` with `nosniff` and a sandboxing CSP. Each upload is
  re-encoded into the three formats, resized to 2400 px at most, and stripped
  of camera metadata, including GPS. The limit is 15 MB per image.
- **Contestant videos are still taken as links**, not files. A season of
  500 MB entries would fill a 50 GB disk shared with the database.

Watch the disk: `df -h /` and `docker system df`. After updates,
`docker image prune -f` clears the old images.

### 3.9 Updating

Push to `main`. When the `docker` workflow is green:

```bash
cd ~/deanslist
docker compose pull && docker compose up -d
docker image prune -f
```

`migrate` runs first on every `up`, so a release that adds a migration applies
it before the new app starts. Take a dump before any release that migrates
(section 3.11); migrations do not roll back.

### 3.10 The scheduler

The `scheduler` container calls the app every five minutes over the internal
network, not through Caddy, so a certificate problem cannot also stop campaign
sends. It idles, and logs why, until `CRON_SECRET` is set.
`.github/workflows/scheduler.yml` can keep running alongside it, since ticks
are safe to overlap, or it can be disabled once the VPS is live.

### 3.11 Backups, with a restore that has been run

The `backup` container writes `backups/deanslist-<date>.dump` and
`backups/uploads-<date>.tar.gz` once a day and keeps 14 days of each. A backup
on the same disk as the database only protects against mistakes, not against
losing the disk, so copy the backups off the server, from another machine:

```bash
rsync -a deploy@SERVER_IP:~/deanslist/backups/ ./deanslist-backups/
```

Take a dump by hand before a migrating release:

```bash
docker compose exec -T db pg_dump -U deanslist --format=custom deanslist > backups/pre-release.dump
```

Restore, tested once into a scratch database and not into production:

```bash
docker compose exec db createdb -U deanslist restore_test
docker compose exec -T db pg_restore --no-owner -U deanslist -d restore_test \
  < backups/deanslist-YYYY-MM-DD-HHMM.dump
docker compose exec db psql -U deanslist -d restore_test -c 'SELECT count(*) FROM "Lead";'
docker compose exec db dropdb -U deanslist restore_test
```

Uploads restore:

```bash
docker run --rm -v deanslist_uploads:/u -v "$PWD/backups:/b:ro" alpine \
  tar -xzf /b/uploads-YYYY-MM-DD-HHMM.tar.gz -C /u
```

**The database volume is tied to Postgres 18.** A later move to 19 is a dump
and restore into a new volume, not an image tag change.

---

## 4. Email domain authentication

This gates every bulk send and depends on DNS, so start it before it is needed.

In Resend, add `deanslist.live` and publish the records it gives you:

- **SPF**: a TXT record authorising Resend to send for the domain
- **DKIM**: the CNAME or TXT records Resend generates
- **DMARC**: start at `v=DMARC1; p=none; rua=mailto:...` to collect reports,
  and tighten to `quarantine` once the reports are clean

`MAIL_FROM` must be on the authenticated domain. Sending as
`noreply@deanslist.live` while only a different domain is authenticated sends
the list's first campaign to spam, and a damaged sender reputation is much
harder to recover than to build.

Verify with `dig TXT deanslist.live`, `dig TXT _dmarc.deanslist.live`, and by
sending one real message to a Gmail address and reading **Show original** for
three `PASS` lines.

---

## 5. DNS cutover — client approval first

Everything above can be done while the old site is still live. This step is the
one the public sees.

Before it: section 7's checklist, all of it, on the new server rather than on
Vercel.

1. Lower the TTL on the existing records to 300 seconds, **at least a day
   ahead**. A record cached at 24 hours keeps sending people to the old site
   for a day after the change. Lowering the TTL at cutover time does not help,
   because the old TTL is what is already cached.
2. Point the `A` records for `deanslist.live` and `www` at the VPS IP. Remove
   any `AAAA` record that points elsewhere.
3. Make sure `SITE_ADDRESS` in `.env` is `deanslist.live, www.deanslist.live`
   and run `docker compose up -d`. Caddy obtains both certificates as soon as
   DNS resolves to it. `docker compose logs -f caddy` shows it happen.
4. Watch `docker compose logs -f app caddy` for the first hour.
5. Raise the TTL back to 3600 once traffic has settled.

---

## 6. Rollback

Vercel: Deployments → the last good one → Promote to Production. Seconds.

VPS: every build is also tagged `sha-<commit>`. Pin the last good one:

```bash
cd ~/deanslist
# .env:  APP_IMAGE=ghcr.io/raselmridha792/deanslist:sha-abc1234
docker compose up -d
```

Set it back to `:latest` once the fix is out.

**Database changes do not roll back with the code.** `prisma migrate deploy` is
forward-only. If the bad release included a migration, restore the dump taken
before it (section 3.11), then pin the old image.

---

## 7. Before handing it to the client

- [ ] `npm run db:purge-test:apply` has been run **before** the Neon dump, so
      the dashboard opens with real rows only
- [ ] The admin password is not the seeded one. `SEED_ADMIN_PASSWORD` was set
      before any seed, and the Team screen shows no warning
- [ ] `AUTH_SECRET`, `POSTGRES_PASSWORD` and `CRON_SECRET` are real
      `openssl rand -hex 32` values, and `.env` is `chmod 600`
- [ ] `NEXT_PUBLIC_SITE_URL` is `https://deanslist.live`
- [ ] `docker compose ps` shows `app` healthy and `migrate` exited 0
- [ ] `/admin/campaigns` shows no configuration warnings
- [ ] `docker compose logs scheduler` shows `tick 200` lines
- [ ] One image uploaded in the dashboard shows on the public page
- [ ] One real submission through each public form appears in the dashboard
- [ ] One real email send lands in an inbox, not in spam
- [ ] `BASE_URL=https://deanslist.live npx playwright test` passes. It also
      covers every old Joomla redirect in `next.config.ts`
- [ ] A database dump **and** an uploads archive have been restored, into a
      scratch database and a scratch volume
- [ ] The backups are being copied off the server
- [ ] `robots.txt` and `/sitemap.xml` resolve on the live domain
