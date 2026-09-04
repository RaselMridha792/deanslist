# Old site audit — deanslist.live

Every fact below was obtained by direct HTTP or DNS request on **4 September 2026**.
The method is given so any of it can be re-checked before a client call.

Anything not verified here must not be repeated to the client as fact. In particular the
"700,000 subscribers" figure in the proposal is **unverified** — see the bottom of this file.

---

## Platform

| Fact | Evidence |
|---|---|
| Joomla | `<meta name="generator" content="Joomla! - Open Source Content Management">` in the homepage source |
| SP Page Builder, UIkit, jQuery 3.7.1, Bootstrap 5.3.3 | asset paths under `/media/` in the homepage source |
| Design credited to GraFitz Group | footer link to `https://grafitz.com` |

**Do not tell the client their CMS is obsolete.** The site's real problems are payload,
data ownership, structure, and compliance — all of which are provable below. Attacking the
CMS invites an argument the developer does not need to win.

---

## 1. Contestant data is not the client's

The "enter" flow is an iframe to a third-party MachForm instance:

```
https://ggnform.com/machform/embed.php?id=88574
https://ggnform.com/machform/embed.php?id=95824
```

Every contestant who has ever entered submitted their name, email and performance link into
a database on `ggnform.com`, not on `deanslist.live`. Whether the client can export that
data, and under what data-processing agreement, is an open question — see `docs/PROJECT-BRIEF.md` §8.

This is the single strongest justification for the whole rebuild.

---

## 2. 96 MB of video, and most of it cannot play

17 video files are referenced across the site, totalling **96.1 MB**. Measured with
`curl -sIL` and reading `content-length` and `content-type`:

| File | Size | Content-Type | Plays in Chrome/Firefox/Edge |
|---|---|---|---|
| `mic.mp4` | 8.9 MB | video/mp4 | yes |
| `mic3.mp4` | 8.9 MB | video/mp4 | yes |
| `youtube4.mov` | 8.9 MB | video/quicktime | **no** |
| `judges.mov` | 8.4 MB | video/quicktime | **no** |
| `what2.mov` | 8.4 MB | video/quicktime | **no** |
| `bass.mov` | 6.7 MB | video/quicktime | **no** |
| `board.mov` | 6.2 MB | video/quicktime | **no** |
| `girl.mov` | 6.0 MB | video/quicktime | **no** |
| `voc-1.mov` | 5.9 MB | video/quicktime | **no** |
| `drum.mov` | 5.7 MB | video/quicktime | **no** |
| `guy.mov` | 5.7 MB | video/quicktime | **no** |
| `rap.mov` | 5.2 MB | video/quicktime | **no** |
| `key.mov` | 4.1 MB | video/quicktime | **no** |
| `youtube1.mov` | 2.4 MB | video/quicktime | **no** |
| `dropmike-video1-2026.mp4` | 2.2 MB | video/mp4 | yes |
| `dropmike-video2-2026.mp4` | 2.0 MB | video/mp4 | yes |
| `envato_video_gen_*.mp4` | 0.5 MB | video/mp4 | yes |

**12 of 17 are QuickTime.** They are declared in the markup as
`<video ... loop autoplay muted playsinline>`, so a browser begins fetching them and then
renders nothing. The homepage alone carries 9 such players. This is bandwidth spent on
content no visitor can see.

Handled in Phase 0.5: transcode to H.264 MP4 + VP9 WebM with poster frames.

---

## 3. 13 MB of images on one page

15 images, **13 MB total**. Five Fireworks-exported PNGs account for nearly all of it:

| File | Size |
|---|---|
| `cs4.fw.png` | 3.7 MB |
| `cs3.fw.png` | 3.0 MB |
| `cs7.fw.png` | 2.4 MB |
| `cs1.fw.png` | 1.9 MB |
| `cs6.fw.png` | 1.7 MB |
| `newfavicon.fw.png` | 364 KB (a favicon) |

Handled in Phase 0.4: WebP/AVIF, long edge capped at 2000px.

---

## 4. Social share previews genuinely do not render

The homepage declares:

```html
<meta property="og:image" content="https://deanslist.live/" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:image" content="https://deanslist.live/" />
<meta name="twitter:site" content="@DEAN&#039;S LIST LTD" />
<meta name="twitter:card" content="summary" />
```

`og:image` points at the site root — an HTML document, not an image. Every share on
Facebook, WhatsApp, LinkedIn or X falls back to a bare link. `twitter:site` is also not a
valid handle, and the card type is `summary` rather than `summary_large_image`.

**This bug currently exists in the rebuild too**: `src/app/layout.tsx` references `/og.jpg`
while `public/` is empty. Fixed in Phase 9.

---

## 5. The statistics band renders broken numbers

The counter markup produces:

- **`.7Mil+`** — YouTube subscribers. The integer part is missing; the animated counter
  starts from an empty value and only the `.7Mil+` suffix survives.
- **`K`** — Facebook followers. No number at all.

This is the most visible defect on the site and needs no technical explanation to the
client. It is also why `SiteStat` exists in the schema and why Phase 3 forbids rendering a
partial number.

---

## 6. 42 dead links

```
42 x href="#"
 6 x href="skype:#?chat"
```

"Contact Us" is among them — the proposal's claim that the contact route is non-functional
holds up. The `skype:#?chat` links resolve to nothing.

Target for the rebuild: zero.

---

## 7. Content contradicts itself

| Page | Says |
|---|---|
| Homepage | "Crown the Sound Winner: **PJ Galloway** Shines" |
| `/index.php/past-challenges/1st-crown-the-sound-winner` | Winner is "**Ekwelem Precious (Sophia)**" |

Two different winners for the same challenge. Dates conflict too: the homepage says
**"Show Starts August 11"** while the winner story is dated **"August 28th"**.

**Neither name may be published until the client confirms.** Both are in `docs/PROJECT-BRIEF.md` §8.

---

## 8. Tracking runs with no consent mechanism

| Fact | Evidence |
|---|---|
| GA4 `G-TE3V4STGHP` | `gtag/js?id=G-TE3V4STGHP` in the homepage source |
| Meta Pixel `4568571810038131` | `facebook.com/tr?id=4568571810038131&ev=PageView` |
| No cookie banner | no `cookieconsent`/`cookiebot`/`onetrust` markup anywhere |
| No privacy policy | the string "privacy" appears **0 times** across all six crawled pages |

Analytics and an advertising pixel fire on load, with no consent gate and no policy to
point at. For a company running a public prize contest this is a real exposure — and if the
rebuild carries it over unchanged, it becomes the developer's problem too.

Phase 4 adds `/privacy` and `/terms`. The wording itself is the client's to supply or
approve; see `docs/PROJECT-BRIEF.md` §8.

---

## 9. Email cannot be sent from this domain yet

| Record | Value |
|---|---|
| SPF | **none** (`nslookup -type=TXT deanslist.live 8.8.8.8` returns no SPF record) |
| DMARC | `v=DMARC1; p=none;` — no policy, no reporting address |

Bulk campaign mail from `noreply@deanslist.live` without SPF and DKIM will land in spam.
Adding these records requires DNS access the developer does not have today, so the campaign
milestone (Phase 7) is gated on a client action. **Start this in week one.**

---

## 10. Redirect map — confirmed against the live sitemap

`/sitemap.xml` exists (generated by xml-sitemaps.com, last modified 2025-11-12) and lists
exactly seven URLs. This is the complete old URL set, so the redirect map can be exhaustive
rather than guessed:

| Old | New |
|---|---|
| `/` | `/` |
| `/index.php` | `/` (301) |
| `/index.php/what-is-the-deans-list` | `/about` |
| `/index.php/join-the-dean-team` | `/join` |
| `/index.php/upcoming-events/deans-list-drop-that-mike-challenge` | `/shows/drop-that-mike` |
| `/index.php/past-challenges/1st-crown-the-sound-winner` | `/winners/[slug]` |
| `/index.php/videos` | `/watch` |

Note the sitemap uses the `www.` host while the site serves from the apex. Add a
`www` → apex 301 at the Nginx layer.

---

## Not verified — do not state as fact

- **"700,000+ subscribers."** Taken from the proposal. The live site's own counter is
  broken (`.7Mil+`), so the site does not corroborate it. The real figure, and more
  importantly the **view counts and engagement rate** behind it, must be read off the
  channel and confirmed by the client before it appears on the new site, in a sponsor deck,
  or in an advertising claim.
- Facebook follower count — the site renders a bare `K`.
- Any winner name (see §7).
- Any show date (see §7).
- Prize amount beyond the `$1,000` figure quoted on the winner page.
