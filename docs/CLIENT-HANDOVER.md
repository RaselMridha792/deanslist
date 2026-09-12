# What the client still has to hand over

Every account, key, permission and decision still outstanding on
`deanslist.live`. Each item is listed with the thing that stops working, or
stays unfinished, until it arrives.

Grouped by consequence rather than by service, because "we need a Resend key"
means nothing to a client and "your campaigns compose but never send" means
something.

**Status as of 12 September 2026.** The site is live on the client's own
Hostinger VPS, on the real domain, with a certificate. Everything in the old
version of this page about Vercel, Neon, Cloudinary and Cloudflare R2 is gone:
there are no third-party hosting accounts left to transfer, because there are no
third-party hosting accounts. The site, its database, its images and its uploads
all sit on one machine in the client's name.

| | Count |
|---|---|
| Blocks a feature | 2 |
| The client enters these without us | 3 |
| Decisions we are waiting on | 5 |
| The client's own property, currently elsewhere | 3 |
| Ownership to transfer | 1 |

**On sending credentials.** Nothing here should arrive by email or chat message.
Every service below supports inviting a person by email address, which is better
than sharing a password because it can be revoked without changing anything
else. Where an invite is not possible, use a password manager's share link with
an expiry. The three values in section 2 need no sending at all — the client
types them into their own dashboard.

---

## 1. Blocks a feature

The site runs without these. Each switches on one capability, and the dashboard
says plainly which are missing rather than failing quietly — that is deliberate,
not a gap.

### 1.1 Email authentication records (SPF, DKIM, DMARC)

- **Who has it.** Whoever holds the DNS for `deanslist.live`, which is at
  Squarespace Domains. The client reached these records for the cutover, so the
  access exists.
- **What we need.** Three records published on the domain. The values come from
  Resend once its account exists, which is why this and 1.2 travel together.
- **Without it.** Every campaign lands in spam. The domain publishes no SPF
  record at all today, and DMARC is set to `p=none`.

> Sender reputation is far harder to repair than to establish. One bulk send
> from an unauthenticated domain can put the list in the spam folder for months,
> and that list is the asset this rebuild exists to create.
>
> The mail records for Google Workspace (the `MX` entries) must not be touched.
> `producer@` and `ceo@` depend on them.

### 1.2 Anthropic API key — the site assistant

- **Who has it.** A development key is in use now. It is on the developer's
  billing, not the client's, so it is not a key that can simply be handed over.
- **What we need.** An account in the client's name and a key. Spend is capped
  in the application itself, so the ceiling is set in code rather than left to
  the invoice.
- **Without it.** The assistant answers only from its written knowledge base.
  The guided entry flow — the part that captures a lead — keeps working either
  way.

---

## 2. The client enters these without us

New since the last version of this page. These used to require a
developer, a code change and a deploy. They are now fields on
**Dashboard → Settings**, which only the owner account can open. Type a value,
press Save, and the public site changes. Leave a field empty and the site falls
back to what it uses today.

### 2.1 The Resend API key — email sending

Create the account at resend.com in the client's own name (the free tier covers
3,000 emails a month, well beyond the current list), verify `deanslist.live`,
then paste the key into Settings. Nothing else is needed from us.

The key is encrypted before it is stored, so a copy of the database is not a
copy of the mail account, and the screen shows only `re_…4f9a` afterwards —
never the key itself. Until a key exists, campaigns compose and preview but a
send is refused outright rather than reported as successful.

### 2.2 The Instagram link

The site shows Facebook and YouTube today. Paste an Instagram profile URL into
Settings and the link appears in the footer, on the contact page, in the chat
panel and in the markup search engines read. Leave it empty and no Instagram
link is shown anywhere.

### 2.3 The Meta Pixel ID

Optional, and only useful if the client intends to run Facebook or Instagram
advertising. With an ID saved, the pixel loads — but only for visitors who
accept the consent banner, which is what the privacy page promises. Decline, and
nothing is requested from Facebook at all. The privacy page rewrites its own
Cookies section as soon as an ID exists, so it always describes what the site is
actually doing.

### 2.4 Google Analytics

Live since 2026-09-13 with the client's property, `G-7NBGLE6F21`, saved on the
same screen, where it can be changed or removed. Pasting the whole Google tag
snippet works: the ID is taken out of it.

The tag is in the HTML of every public page, which is what Google's
installation check looks for. It starts with analytics cookies denied, so
Google receives an anonymous page view from everyone but sets cookies only for
visitors who choose Allow on the banner. Checked on the live site: no `_ga`
cookie before a choice, `_ga` and `_ga_7NBGLE6F21` after Allow, and every hit
addressed to this property. Dashboard pages are not tagged.

The reports are in Google Analytics itself, at analytics.google.com. Expect
their visitor numbers to run well below the real total: a visitor who never
answers the banner does not appear in its reports at all. Google fills that
gap with estimates only on much busier sites, of more than a thousand such
visits a day. For the full count, use the dashboard's own Analytics screen
below. Data appears in the Realtime report within a minute of a visitor
choosing Allow; the Home screen's "No data received" notice can take a day or
two to clear on a new property.

### 2.5 Visitor statistics, in the dashboard

**Dashboard → Analytics** shows how many people visit, where they came from
and what they read, with nothing to set up. The site counts it itself: no
cookies, no stored IP addresses, and so no banner needed. It therefore counts
every visitor, including the ones Google Analytics never sees, and the two
will not agree. This one is the fuller count.

For today, 7, 30 or 90 days, or 12 months, it shows visitors and page views
with the change on the period before; a chart by hour, day or month; the most
read pages; where visitors came from (Facebook, YouTube, Instagram, Google,
direct); countries; tagged campaigns; and phones against computers.

A visitor is one person on one day, because nothing is kept that could
recognise them the next day. Bots and signed-in staff are not counted. Country
data is IP Geolocation by DB-IP, credited on the screen as its free licence
requires.

To see an ad or an email in the Campaigns table, tag its link, for example
`https://deanslist.live/enter?utm_source=facebook&utm_campaign=watch-party`.

> The YouTube and Facebook links are on the same screen, so the client can
> change those without us as well.

---

## 3. Decisions we are waiting on

These need an answer rather than a login. Each is currently withheld from the
public site rather than guessed at.

- **Sign-off on the general rules.** The official rules PDF is published. The
  shorter summary shown on the site is ours, written from that PDF, and a public
  prize competition's rules should be approved by the person legally responsible
  for them.
- **The weekly entry deadline.** The show time is settled — Tuesdays at 7:00 PM
  ET. What is not settled is the moment entries close each week. The site
  currently avoids stating one.
- **Terms and Privacy wording.** Both pages exist and are honest about what the
  site does. Neither has been read by the client's attorney.
- **Sponsorship pricing.** The tiers are described and the page says "contact
  for pricing", as asked. Figures go in whenever there are figures.
- **Somewhere off this server to keep the backups.** The database and the
  uploaded images are backed up every night on the VPS itself, kept for
  fourteen days, and a restore has been tested. What that does not survive is
  losing the machine. Any destination works — a Backblaze B2 bucket, a Google
  Drive folder, another server.

---

## 4. The client's own property, currently elsewhere

Not needed for anything to work. Worth doing regardless, because each is
something the client already owns and does not currently hold.

### 4.1 Existing contestant data on ggnform.com
Two forms — `88574` and `95824` — collecting entries and talent pool signups on
a third party's server. We need a login or an export; the records import into
the new dashboard so past entrants sit on the same list as new ones.

**This is the client's own contact data on someone else's system.** It should be
retrieved whether or not it is ever imported.

### 4.2 The old GoDaddy hosting
The domain used to answer from `107.180.116.5`. It does not any more, and
nothing on the new site touches it. If that hosting is still being paid for, it
is now being paid for nothing — confirm who owns the subscription before
cancelling it, and keep the domain registration itself well clear of the
cancellation.

### 4.3 The Squarespace subscription
Separate from Squarespace Domains, which holds the DNS and must stay. If a
Squarespace *website* plan is also being paid for, it serves nothing now.

---

## 5. Ownership to transfer

### 5.1 GitHub — the source code
The one remaining account in the developer's name. The running site does not
depend on it — the server keeps working whatever happens to the repository —
but whoever maintains the site next needs it. Without it the client owns a
running website and no way to change it.

The VPS itself is already in the client's Hostinger account, and the database,
the images and the uploads are all on it.

---

## What has been answered since this page was written

Kept as a record, so nothing is asked for twice.

- DNS control, and the cutover itself. Done on 11 September 2026; the domain and
  `www` both answer from the VPS over HTTPS.
- The `producer@` and `ceo@` mailboxes. Confirmed and in use — talent referrals
  to the producer, ownership and business matters to the CEO only.
- Show time: Tuesdays at 7:00 PM ET.
- The official rules, as a PDF.
- A photograph of PJ Galloway.
- The countries figure: 10, replacing the unsourced "30+".
- Sponsorship: "contact for pricing" for now.
- File uploads. No object storage account is needed — dashboard uploads are
  written to the VPS's own disk and served from it, and contestant video still
  arrives as a link rather than a file.
- The YouTube channel: `@deanslistllc`, 369K subscribers.

---

Every item above was checked against the running site and the live domain rather
than assumed. Where a fact is stated — an IP, a form id, a missing DNS record —
it was looked up.
