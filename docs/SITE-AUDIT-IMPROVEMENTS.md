# What is worth fixing next

An improvement audit of the live site. Seventeen public pages measured in a real
browser against `deanslist-one.vercel.app`. **Nothing has been changed** — this
is a report.

Measured 7 September 2026, at 1440px and 390px.

**How this was measured.** A headless Chromium loaded each route, recorded every
byte transferred, then walked the DOM computing the contrast of each piece of
text against its real composited background, the heading order, unlabelled
controls, and horizontal overflow at 390px. Contrast thresholds are WCAG AA:
4.5:1 for body text, 3:1 at 24px or above. Where a claim below is about intent
rather than measurement, it says so.

| | Count |
|---|---|
| Fix before the ads run or before launch | 4 |
| Worth doing soon | 5 |
| Polish | 4 |
| Checked and clean | 9 |

---

## 1. Performance

### 1.1 The homepage ships 5 MB of video before anyone asks for it
**Before ads**

| | |
|---|---|
| Homepage total | **5,966 KB** |
| Of that, video | **5,183 KB** |
| Autoplaying clips | **10** |
| Largest single clip | **1,064 KB** (`bass.webm`) |

Ten `<video>` elements autoplay on load: the hero and the nine-cell reel. Nine
carry `preload="none"`, which does nothing here — **autoplay overrides it**, so
the browser fetches them all anyway.

This matters more now than it did last week. Paid traffic arrives on mobile data
and leaves while a page is still loading, so this is money spent on clicks that
never see the form. It is also the largest thing on the site by a wide margin:
the next heaviest page is 1,383 KB and every other page is under 300 KB.

**What would fix it.** Play only the clip in view, using an IntersectionObserver,
and give the rest a poster frame until then. The posters already exist. Expect
the homepage near 800 KB with no change to how it looks at rest.

### 1.2 One clip is downloaded twice on the same page
**Soon** — 511 KB wasted per visit

`/media/hero/mic` is the hero background and also the first cell of the reel.
Two elements, two requests, same file.

**What would fix it.** Use a different clip in one of the two places. That is
also the better answer visually — the hero and the strip beneath it currently
show the same footage twice.

### 1.3 A cold page took 14.8 seconds
**Soon**

| | |
|---|---|
| `/join`, first hit | **14,840 ms** (failed to finish) |
| Same page, warm | **~250 ms** |

A serverless cold start, and a property of the free hosting tier rather than a
bug in the site. Worth knowing because **an ad can land on a cold page**, and
fourteen seconds is not a page anyone waits for.

**What would fix it.** Either the paid hosting tier, which keeps functions warm,
or a scheduled request every few minutes to the pages the ads point at. The
scheduler for that already exists.

---

## 2. Readability and accessibility

### 2.1 Small grey text fails contrast on every page of the site
**Before launch**

| | |
|---|---|
| Pages affected | **17 / 17** |
| Worst measured | **2.59:1** |
| Required | **4.5:1** |
| Failures on `/rules` | **27** |

Two greys are doing most of the damage:

- `#7d7979` — measures **3.55:1 to 4.3:1** at 11–12px
- `#9b9797` — measures **2.59:1**

They are used for help text under form fields, the small labels above values,
hashtags, and field hints — **exactly the text that explains what to do**.

This is the same class of problem that was found and fixed inside the dashboard.
The public site was never measured, so it was never fixed there. It is a one-line
change per token, not a redesign.

**What would fix it.** Darken the two greys by roughly one step each and
re-measure. `npm run audit:contrast` already does this for the dashboard;
pointing it at the public routes turns this into a check that cannot regress.

### 2.2 Structured data is on 3 pages out of 17
**Polish**

The homepage, the show page and the winner page carry JSON-LD. The campaign pages
do not, and they are the best candidates on the site: a contest with a named
prize, a start and an end is what search engines render as a rich result.

**What would fix it.** `Event` markup on campaign pages, generated from the row
the page already reads. No new content required.

---

## 3. Content and risk

### 3.1 The homepage counts down to a date nobody set
**Before ads**

| | |
|---|---|
| What the site counts to | **8:00 pm, visitor's own timezone** |
| What the client's poster says | **7:00 pm EST** |

No show has a confirmed date in the dashboard, so the countdown falls back to
**the next Tuesday at 8pm in the visitor's own timezone** — and presents that as
a real countdown. At the time of measurement it read 01 day, 06 hours, 49
minutes.

Two problems, and the second is worse. The time is wrong: the client's own
"Calling All Talent" poster says 7PM EST. And it is computed per visitor, so
someone in another timezone is counting to a different moment entirely. A viewer
who arrives when the counter hits zero misses the start — and this is the number
the ads will point people at.

**What would fix it.** Set the real date and time in the dashboard, which already
stores a timezone alongside it. Until one is set the countdown should not render
at all: an absent countdown costs nothing, a confident wrong one costs an
audience.

### 3.2 Draft contest rules are published as "the official rules"
**Before ads**

| | |
|---|---|
| Its robots directive | **`index, follow`** |
| Pending-review notice | **none** |

`/rules` presents itself as **"The official rules"** and is indexable by search
engines. The project notes record that this page was meant to ship as an outline,
carrying a visible "pending legal review" banner and a `noindex`, until the real
wording arrives. Neither is on the live page.

For a public prize competition with cash payouts this is the highest-risk item on
the site. Entrants can reasonably rely on published rules, and an ad campaign is
about to send strangers to read them.

**What would fix it.** Restore the pending banner and the `noindex` today, and
get the real wording from the client. `/privacy` and `/terms` both carry that
banner correctly — `/rules` is the one that lost it.

### 3.3 Five facts are still withheld, and three of them sell the show
**Soon**

Deliberately blank rather than guessed, which was the right call. But each is a
gap a visitor notices:

- No photograph of the winner
- No confirmed show date
- No sponsorship pricing
- No source for the "30+ countries" claim
- No official rules wording

The winner photograph costs the most. The spotlight cell shows initials and
"portrait to come" — **on the page whose whole job is proving somebody really got
paid**. The reel now playing there helps; a face would help more.

**What would fix it.** All five are questions for the client, not development
work. They are on the handover list already.

---

## 4. Functionality

### 4.1 Email and the scheduler are switched off in production
**Before launch**

| | |
|---|---|
| `/api/cron/tick` | **503** |
| `RESEND_API_KEY` | **not set** |

Both keys exist locally and neither is on the deployment, so the campaign system
is fully built and fully inert. A scheduled send would sit in the queue forever,
and the endpoint correctly refuses rather than pretending.

**What would fix it.** Two environment variables on the hosting project, then
redeploy. The dashboard names both on the campaigns screen.

### 4.2 Meta Pixel is not installed, so the ads cannot learn
**Soon**

| | |
|---|---|
| Tracking scripts on the site | **0** |
| Campaign attribution stored | **yes** |

Registrations now record which campaign and which creative produced them, so
**you can tell what worked**. Meta cannot. Without the pixel its optimiser has no
conversion signal, so it spends the budget on clicks rather than on
registrations.

Two things travel with it:

1. `/privacy` currently states the site sets no advertising cookies and that any
   tracking will sit behind a consent banner. Installing a pixel without building
   that banner makes the privacy policy false — the exact fault the old site was
   criticised for.
2. A browser pixel loses a meaningful share of events to ad blockers and iOS,
   which the Conversions API recovers. The click id needed for that is already
   being stored.

**What would fix it.** Pixel, consent banner and privacy update as one change,
then the Conversions API. Needs a Pixel ID from the client's Meta Business
account.

### 4.3 Contestants cannot upload anything
**Soon**

The entry form draws an upload control and shows it disabled, with an honest
note. The client's own existing form asks for a professional headshot, so this is
a capability the business already expects to have.

**What would fix it.** A storage bucket and a key pair. The database model and
the feature flag are already in place; the work is the upload path itself.

### 4.4 No way to search or filter anything
**Polish**

Fine today: two shows, two winners, two campaigns, a handful of episodes. It
stops being fine at roughly a dozen of anything — a viewer looking for last
month's episode has to scroll the whole grid.

**What would fix it.** Filter the watch grid by show and the winners by season.
Worth doing when the counts justify it, not before.

### 4.5 The database is shared with the test suite
**Polish**

One connection string serves the site and the automated tests, so a test run
writes real rows into the same table the dashboard reads. The purge command
exists and works, but the underlying arrangement is the thing to fix.

**What would fix it.** A second database for tests. It arrives naturally with the
move to the VPS, where the database is self-hosted anyway.

---

## Page weight, measured

Everything except the homepage and the show page is comfortably light. The gap
between them is the whole performance story.

| Route | Transferred | Contrast fails | Words |
|---|---:|---:|---:|
| `/` | **5,966 KB** | 8 | 674 |
| `/shows/drop-that-mike` | **1,383 KB** | 6 | 486 |
| `/watch` | 295 KB | 7 | 271 |
| `/campaigns` | 284 KB | 7 | 287 |
| `/campaigns/watch-party-contest` | 192 KB | 9 | 396 |
| `/winners/pj-galloway` | 155 KB | 10 | 322 |
| `/shows` | 139 KB | 8 | 280 |
| `/about` | 112 KB | 7 | 420 |
| `/sponsors` | 96 KB | 6 | 435 |
| `/winners` | 91 KB | **11** | 394 |
| `/enter` | 91 KB | 9 | 213 |
| `/register` | 87 KB | 3 | 239 |
| `/terms` | 68 KB | 6 | 379 |
| `/rules` | 67 KB | **27** | 542 |
| `/contact` | 67 KB | 10 | 233 |
| `/privacy` | 67 KB | 6 | 617 |

`/join` is missing from this table: it failed its first load (see 1.3) and
answered normally on retry.

---

## Checked, and clean

Recorded so these are not re-investigated later.

- No horizontal overflow on any of the 17 routes at 390px
- Exactly one `<h1>` per page, and no skipped heading levels anywhere
- Every image carries an `alt` attribute
- Every page has a meta description and a share image
- No broken subresources across the whole site
- One console message site-wide, and it is a benign YouTube permissions warning
- Every form control has an associated label
- The ad landing page links nowhere except the privacy policy
- Campaign attribution survives a landing page and a navigation

One correction worth recording: the audit script initially reported an
"unlabelled link" on 15 pages. Checking it, that is the footer logo link, whose
accessible name comes from the `alt` on the image inside it. The script was
wrong, not the site, so it is not listed as a finding.

---

## If you only do three things

1. **`/rules`** — restore the `noindex` and the pending banner. Minutes of work,
   and it is the only legal exposure on the list.
2. **The two greys** — one step darker each. One line per token, fixes 17 pages.
3. **Homepage video** — play only what is in view. The single biggest
   improvement to what a paid click actually experiences.

The first two together are about an hour.
