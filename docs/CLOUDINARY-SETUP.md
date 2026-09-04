# Hosting media on Cloudinary

Written for someone who has never used Cloudinary. Follow it top to bottom once.

**What this does:** moves the 113 media files (32 images × 3 formats, 17 videos ×
mp4 + webm + poster) off the app server and onto Cloudinary's CDN, so the VPS
never has to serve them.

---

## The one thing to understand first

Cloudinary gives you three values. They are not interchangeable and only one of
them is a secret:

| Value | Example | Secret? | Used for |
|---|---|---|---|
| **Cloud name** | `dueb6id6i` | No — it appears in every image URL | Serving |
| **API key** | `993338391135585` | No, but keep it tidy | Uploading |
| **API secret** | hidden behind `••••••` | **Yes** | Uploading |

Uploading needs all three. **Serving needs only the cloud name.** That is why the
public URLs are safe to commit and the secret is not.

---

## Step 1 — Get the API secret

You already have the cloud name and API key; they are visible on the API Keys
page. The secret is hidden.

1. Go to **Cloudinary → Settings → API Keys**
   (or the key icon in the top bar → **API Keys**).
2. Find the row for your key — the one named `deanslist`.
3. In the **API Secret** column the value is masked as `••••••••`. Reveal it with
   the **eye icon** next to it, or open the **⋮ menu at the right end of the row**
   and choose the reveal / copy option.
4. Copy the revealed string. It is about 27 characters of letters, digits, `-`
   and `_`.

If the eye icon asks you to re-enter your password or complete 2FA, that is
normal — it is guarding the secret.

---

## Step 2 — Put it in `.env`

Open `.env` in the project root. **Not `.env.example`** — that one is the
template and is committed to GitHub. `.env` is gitignored and never leaves your
machine.

Add this line, replacing `PASTE_SECRET_HERE` with what you copied:

```
CLOUDINARY_URL=cloudinary://993338391135585:PASTE_SECRET_HERE@dueb6id6i
```

Reading the format: `cloudinary://` + API key + `:` + API secret + `@` + cloud name.

Common mistakes:

- Leaving the angle brackets in — it is `:abc123@`, not `:<abc123>@`
- A space before or after the `=`
- Quotes are fine (`CLOUDINARY_URL="cloudinary://..."`) but not required
- Pasting the secret where the key goes; the key is the shorter, all-digits one

---

## Step 3 — Test before uploading

```
node scripts/upload-media.mjs --test
```

Expected:

```
credentials OK
  cloud name : dueb6id6i
  api key    : 993338391135585
  api secret : *************************** (27 chars, accepted)
```

If it says `credentials REJECTED (HTTP 401)` the key or secret is wrong — go back
to step 1. `HTTP 404` means the cloud name (after the `@`) is wrong.

Testing first matters: a wrong secret fails on all 113 uploads, which looks like
a broken script rather than a typo.

---

## Step 4 — Upload

```
node scripts/upload-media.mjs
```

It uploads one file at a time — a free account rate limits, and a half-uploaded
set is worse than a slow one. Expect a few minutes. Progress prints as it goes.

Everything lands under a `deanslist/` folder in your Media Library, mirroring the
local structure: `deanslist/hero/mic.mp4`, `deanslist/gallery/cts-01.avif`, and
so on.

When it finishes it prints the exact two lines for the next step.

---

## Step 5 — Point the site at Cloudinary

Add to `.env`:

```
NEXT_PUBLIC_MEDIA_IMAGE_BASE="https://res.cloudinary.com/dueb6id6i/image/upload/deanslist"
NEXT_PUBLIC_MEDIA_VIDEO_BASE="https://res.cloudinary.com/dueb6id6i/video/upload/deanslist"
```

Two bases, not one, because Cloudinary serves images from `/image/upload/` and
video from `/video/upload/`.

These carry the `NEXT_PUBLIC_` prefix, which means they are sent to the browser.
That is correct and safe — they contain only the cloud name. **Never put
`NEXT_PUBLIC_` on `CLOUDINARY_URL`.**

Then rebuild:

```
npm run build
npm run dev
```

---

## Step 6 — Verify

```
node scripts/upload-media.mjs --check
```

This fetches every expected URL and reports anything missing. It needs no
credentials, because serving is public.

You can also open one directly in a browser:

```
https://res.cloudinary.com/dueb6id6i/image/upload/deanslist/brand/logo.png
```

---

## Re-uploading later

If the images or videos are regenerated, just run the upload again. Files are
uploaded with `overwrite: true` and `invalidate: true`, so Cloudinary replaces
them and clears its CDN cache.

---

## One limit to watch

The free plan gives 25 credits a month; roughly, 1 credit ≈ 1 GB of bandwidth.

The hero video is about 780 KB. If it plays on most homepage visits, the whole
monthly allowance is gone in roughly 25,000 visits — and when it runs out,
images and video stop loading.

For a site being promoted to a large YouTube audience on a show night, that is a
real risk. **Cloudflare R2 has no egress charge at all**, which makes it the
better home for video specifically.

The site is already built for this: `NEXT_PUBLIC_MEDIA_IMAGE_BASE` and
`NEXT_PUBLIC_MEDIA_VIDEO_BASE` are independent, so images can stay on Cloudinary
while video moves to R2, by changing one line and rebuilding. No code changes.

Watch usage under **Cloudinary → Settings → Account → Usage**.
