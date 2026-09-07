# What the client has to hand over

Every account, key and permission still needed to hand `deanslist.live` over.
Each item is listed with the thing that stops working until it arrives.

Grouped by consequence rather than by service, because "we need Cloudinary" means
nothing to a client and "your site's images stop loading" means something.

| | Count |
|---|---|
| Blocks the launch | 3 |
| Blocks a feature | 3 |
| Ownership to transfer | 5 |
| The client's own property, currently elsewhere | 3 |

**On sending credentials.** Nothing here should arrive by email or chat message.
Every service below supports inviting a person by email address, which is better
than sharing a password because it can be revoked without changing anything else.
Where an invite is not possible, use a password manager's share link with an
expiry.

---

## 1. Blocks the launch

Without these the new site cannot appear at `deanslist.live`, no matter how
finished it is. They also depend on a third party rather than on the client
alone, which is why they are worth starting first.

### 1.1 DNS control for deanslist.live

- **Who has it.** The website manager. The domain answers from a GoDaddy address
  (`107.180.116.5`) with nameservers at Google Cloud DNS, so whoever holds the
  nameservers is who has to make the change — not whoever holds the hosting.
- **What we need.** Either an account on the DNS provider, or the manager's
  agreement to make three changes on a scheduled day: lower the TTL, repoint the
  `A` record, add a `www` alias.
- **Without it.** The site can never go live on the real domain. It stays at the
  preview URL indefinitely.

> The TTL has to be lowered **at least a day before** the cutover. Records already
> cached at the old value keep sending visitors to the old site for that long, and
> lowering it on the day does not help.

### 1.2 Email authentication records (SPF, DKIM, DMARC)

- **Who has it.** The same DNS access as above. This is why the two travel
  together.
- **What we need.** Permission to publish three DNS records on `deanslist.live`.
  The values come from the email provider once its account exists.
- **Without it.** Every campaign lands in spam. The domain currently publishes no
  SPF record at all, and DMARC is set to `p=none`.

> Sender reputation is far harder to repair than to establish. One bulk send from
> an unauthenticated domain can put the list in the spam folder for months, and
> the list is the asset this rebuild exists to create.

### 1.3 producer@deanslist.live mailbox

- **Who has it.** The client. Mail for the domain is on Google Workspace, so the
  mailbox exists already.
- **What we need.** Confirmation that this address is monitored, and access for
  whoever will answer it. It is the address on the contact page, in the site
  footer, and in the required postal footer of every campaign.
- **Without it.** Enquiries arrive nowhere. Form submissions still reach the
  dashboard, but the reply address on the public site is unattended.

> This replaces `deanslistltd@gmail.com`, which the old site publishes. A gmail
> address cannot pass DMARC alignment for deanslist.live, so it cannot be the
> sending address for campaigns.

---

## 2. Blocks a feature

The site runs without these. Each one switches on a specific capability, and the
dashboard says plainly which are missing rather than failing quietly — that is
deliberate, not a gap.

### 2.1 Resend account — email sending

- **Who has it.** Nobody yet. The account has to be created in the client's name.
- **What we need.** An account on the client's own billing, and an API key. The
  free tier covers 3,000 emails a month, well beyond the current list.
- **Without it.** Campaigns compose and preview but never send. A send is refused
  outright rather than reported as successful.

### 2.2 Anthropic API key — the site assistant

- **Who has it.** A development key is in use now. It is on the developer's
  billing, not the client's, so it is not a key that can be handed over.
- **What we need.** An account in the client's name and a key. Spend is capped in
  the application itself, so the ceiling is set in code and not left to the
  invoice.
- **Without it.** The assistant answers only from its written knowledge base. The
  guided entry flow — the part that captures a lead — keeps working either way.

### 2.3 Object storage — file uploads

- **Who has it.** Nobody yet. Cloudflare R2 is the intended provider; its free
  tier is 10 GB.
- **What we need.** A bucket, an endpoint, and a read/write key pair. Five
  settings in total, all named `STORAGE_*`.
- **Without it.** Contestants cannot upload a file. The entry form's upload
  control renders disabled and says so, and entries come in as links instead.

> The client's own existing entry form asks for a professional headshot. Matching
> that means somewhere to put the file.

---

## 3. Ownership to transfer

These are working today, in the developer's accounts. Nothing breaks on handover
day, but until they move, the client's website depends on someone else's login —
including the ability to take it offline.

For each: create a free account and send the email address you signed up with.
Ownership transfers across.

### 3.1 Vercel — where the site is served
An account in the client's name; the project transfers into it, or the client is
added as an owner. Free tier is sufficient for current traffic. If the Hostinger
VPS route is taken, this item disappears and is replaced by 3.5.

### 3.2 Neon — the database
**The important one.** It holds every lead, entry and subscriber. Of everything
on this page it is the one asset that cannot be rebuilt from the code, so it
should not sit in a third party's account.

### 3.3 Cloudinary — images and video
Every photograph and clip on the site is served from it. If that account ever
lapses, the site's imagery stops loading even though the site itself is fine.

### 3.4 GitHub — the source code
Whoever maintains the site next needs it. Without it the client owns a running
website and no way to change it.

### 3.5 Hostinger VPS — only if self-hosting
Root or sudo access, in the client's Hostinger account. Only needed if the site
moves off Vercel. Self-hosting puts the site and its database on one machine the
client owns outright; it also makes backups, updates and uptime someone's job
rather than the platform's.

---

## 4. The client's own property, currently elsewhere

Not needed to launch. Worth doing regardless of this project, because each one is
something the client already owns and does not currently hold.

### 4.1 Existing contestant data on ggnform.com
Two forms — `88574` and `95824` — collecting entries and talent pool signups on a
third party's server. We need a login or an export; the records import into the
new dashboard so past entrants are on the same list as new ones.

**This is the client's own contact data sitting on someone else's system.** It
should be retrieved whether or not it is imported.

### 4.2 Squarespace subscription
The client pays for Squarespace, but the live site is served through GoDaddy — so
it appears to be paying for nothing already. Confirm who owns the subscription
and whether to cancel after cutover.

### 4.3 YouTube and Facebook admin
Nothing technical: the site only links out and embeds public posts. What is needed
is confirmation that the client controls `@DeansList2025` and `Deanslistltd2025`,
since the site's audience figures and the winner's video both come from them.

---

## 5. Answers, not accounts

These need a decision rather than a login. Each is currently withheld from the
public site rather than guessed at, because publishing an unverified figure to a
sponsor is worse than publishing nothing.

- **A photograph of the winner.** The old site carries none, and no unconfirmed
  face will be published under a winner's name.
- **The next show date and entry deadline.** The old site gives two conflicting
  dates. The countdown appears as soon as one is confirmed. (See
  `SITE-AUDIT-IMPROVEMENTS.md` 3.1 — the countdown is currently guessing.)
- **The official contest rules and eligibility.** A legal document for a public
  prize competition, not something to draft on the client's behalf.
- **Sponsorship pricing.** The tiers are described; no figures are published.
- **The "30+ countries" claim.** Flagged as a placeholder in the design with no
  source behind it.

---

Every item above was checked against the running site and the live domain rather
than assumed. Where a fact is stated — a nameserver, an IP, a form id, a missing
DNS record — it was looked up.
