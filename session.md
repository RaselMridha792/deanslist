# Client details — Dean's List

Facts supplied by the client. Anything here overrides what was scraped from the old
site; anything NOT here is still an open question and must not be invented.

Last updated: 4 September 2026

---

## Design

The client supplied a full redesign on 5 September 2026:
`Downloads/Deanslist Homepage Redesign/design_handoff_deanslist/`, twelve
`*.dc.html` reference pages plus a README of tokens and behaviour.

It replaces the dark system entirely. Light editorial: paper ground `#f3f2f2`,
near-black ink `#201e1d`, red `#d40000` as the only accent, Archivo throughout,
**zero border radius**, 2px rules, and every photograph and video in grayscale.

One thing worth recording because it looks like a contradiction: the bundled
design-system stylesheet ships `--color-accent: #ec3013`, but every design file
overrides it to `#d40000` in its own `<style>` block, and the handoff says so
outright — "Red primary is #d40000 (not orange)". `#d40000` is correct.

All referenced assets were already harvested, transcoded and uploaded during the
earlier phases — 12 gallery photographs, 9 clips with poster frames, logo, key
art. Verified present on Cloudinary. **Nothing needs downloading from
deanslist.live.**

---

## Brand

| | |
|---|---|
| Brand name | **Dean's List** |
| Legal entity | Dean's List LTD |
| Current website | deanslist.live |
| Facebook | [Deanslistltd2025](https://www.facebook.com/Deanslistltd2025) |
| YouTube | [@DeansList2025](https://www.youtube.com/@DeansList2025) |

**Brand guideline:** none supplied yet — no colour spec, no logo files, no content
guide. The current design system was derived from the old site's own palette and the
proposal's brief (deep charcoal base, brand red, metallic gold accent). If the client
has an actual brand guide, the tokens in `tailwind.config.ts` should be reconciled
against it before launch.

---

## Contact

**Business address**
```
5619 1/2 SW MacCorkle Avenue
South Charleston, WV 25309
```

**Primary contact email:** `Producer@deanslist.live`

> Supersedes `deanslistltd@gmail.com`, which is what the old site publishes. A
> branded address on the client's own domain is also what an email provider wants
> to see on a sending domain — a gmail.com sender fails DMARC alignment for
> deanslist.live and lands in spam.

The old site's footer says only "Charleston WV". The new site now carries the full
street address, which matters beyond tidiness: **CAN-SPAM requires a physical postal
address in every marketing email**, and the campaign templates need one.

---

## Hosting — needs resolving before DNS cutover

The client **pays for Squarespace**, but the site is currently served through
**GoDaddy**, because the website manager has a relationship there.

Verified independently: `deanslive.live` resolves to `107.180.116.5` (a GoDaddy
range) with nameservers at Google Cloud DNS and MX at Google Workspace.

**Why this matters:** the cutover needs DNS control, not hosting control. Whoever
holds the nameservers is who has to make the change. Three things to confirm before
launch day:

1. Who can edit DNS records for `deanslist.live` — the client, or the website manager?
2. Is the Squarespace subscription still needed after cutover, or is it being paid
   for nothing? (It appears to be unused already.)
3. SPF, DKIM and DMARC records must be added to the sending domain **before** any
   bulk campaign. `deanslist.live` currently has **no SPF record at all** and DMARC
   `p=none`. This is a hard gate on the campaign system and depends on someone else's
   access — start it early.

---

## Leads required

The client needs, for every lead:

- **Name**
- **Email**
- **Address**
- **Phone**

**Address is a new requirement** and was not in the signed proposal's field list. It
does match the client's own MachForm "Talent Pool" form (id 88574), which collects
street address, line 2, city, state/province/region, postal code and country — so
this is consistent with how they already work, not a change of mind.

Implemented in `Lead`: `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`,
`country`.

A note worth putting to the client: **every required field costs entries.** A postal
address is four more boxes on a phone, and this audience arrives from Facebook and
YouTube on a phone. Consider collecting the address at shortlist stage rather than at
entry, and keeping the entry form to name, email, phone and the performance link.
The fields exist either way; making them required is a switch, not a rebuild.

---

## Still unconfirmed — do not invent these

Carried forward from `docs/PROJECT-BRIEF.md` §8 and still open:

1. **Winner name.** The old homepage says *PJ Galloway*; its own winners page says
   *Ekwelem Precious (Sophia)*, for the same Crown the Sound challenge. Currently
   published as PJ Galloway on the client's instruction, but still unconfirmed.
2. **Winner photograph.** The old winner page carries no picture of the winner at
   all, only the site logo. The UI renders a designed placeholder rather than
   substituting an unidentified person from the gallery.
3. **Next show date and entry deadline.** The old homepage says "Show Starts August
   11" while its own winner story is dated August 28. Both are unpublished; the
   countdown appears the moment a real date is entered in the dashboard.
4. **Audience figures — three different numbers now.** The signed proposal says
   700,000+. The new design also shows "700K+ YouTube subscribers". But the
   client's own live site, once its counter finishes animating, reads
   **1.7Mil+ YouTube and 208K Facebook** — two and a half times the proposal's
   figure. An earlier capture read that counter as broken (".7Mil+") because a
   static fetch catches it mid-count; it is not broken, it was mis-measured.

   All of them are stored with `verified: false` and **withheld from the public
   site** until someone confirms the real number against the channel. Shown to a
   sponsor this is an advertising claim, and three sources disagreeing is exactly
   the case for not guessing.

   The design's "30+ countries" cell is flagged as a placeholder in the handoff
   itself and has no source at all.

   Original note: the proposal claims 700,000+ subscribers. The old site's own
   counter renders `.7Mil+` and a bare `K`, so it corroborates nothing. Stored with
   `verified: false` and **withheld from the public site** until someone confirms it.
   This is an advertising claim shown to sponsors — it needs to be right.
5. **Official contest rules, eligibility and prize terms.** `/rules` ships as an
   honest outline saying the wording is pending, and is `noindex` until it lands.
   Contest rules are a legal document for a public prize competition; drafting them
   on the client's behalf would be worse than admitting they are not ready.
6. **Privacy policy wording.** `/privacy` describes what the code actually does with
   personal data, which is checkable. The formal framing — registered company
   details, lawful basis, retention periods, supervisory authority — needs the
   client's sign-off.
7. **Sponsorship package pricing.** Tiers are described; no figures published.
8. **Headshot upload.** The client's Talent Pool form asks for a professional
   headshot. Not yet built — it needs object storage (the `Asset` model exists,
   unwired). Confirm whether it is wanted at entry or at shortlist.

---

## Decisions taken while implementing the design

Recorded because each one is a judgement the client may want to reverse, and
none of them is visible from the rendered page.

**The 700,000 figure was removed from the /about paragraph.** The design's
section 01 reads "an audience of over 700,000 subscribers votes live". The page
now reads "an audience votes live". The words are held back rather than
published because three sources disagree about that number and none is
confirmed. Restore the clause the moment a figure is verified; a comment in
`src/app/(site)/about/page.tsx` records the exact removed words.

**No photograph is used for any winner.** The design captions a gallery frame as
"PJ Galloway, Crown the Sound winner", and an earlier build fell back to the
show key art. Both are photographs of identifiable people, and neither has been
confirmed as the winner. A photograph beside a winner's name in a section headed
"Latest winner" tells every sighted visitor that is who it is, so both the
homepage spotlight and the winners page now use a typographic plate. A real
portrait uploaded through the dashboard replaces it with no code change.

**Both winner names are still published.** The homepage credits PJ Galloway with
the latest challenge; the winners page credits Ekwelem Precious (Sophia) with
"the most recent" one. Both are the client's own published copy. PJ Galloway
leads, per instruction. The order needs confirming.

**The /videos copy the client wrote is no longer on the site.** The rebuild had
restored their "What you'll find on our YouTube channel" and "Why subscribe"
sections; the new design's Watch page goes straight from the video library to
the footer, so they were removed. The constants are still in
`src/content/site.ts` with no consumer, so putting them back is a paste. Worth
asking whether they want them.

**The /rules page now publishes real terms.** The design contains 19 clauses the
client wrote, so the "awaiting official wording" placeholder and the noindex are
gone and the clauses are published verbatim. They still carry the design's own
footnote: "Final wording to be confirmed by Dean's List LTD." Nothing was
drafted, extended or paraphrased.

**Four of the five thank-you states are written, not the client's.** The design
supplies copy only for a contestant arrival. The talent pool, crew, sponsor and
general states are marked "Written for review" in the file and claim no date,
prize, name or figure.

**The file upload on /enter is not wired.** The design offers "MP4/MOV up to
500 MB" as an alternative to a performance link. Object storage is not connected
(the `Asset` model exists, unused), so the control is not presented as working.
See the headshot question below; both need the same decision.

---

## Access still needed from the client

- DNS control for `deanslist.live` (or the website manager's cooperation)
- Confirmation of who owns the Squarespace subscription and whether to cancel it
- Export of existing contestant data from the MachForm at `ggnform.com`
  (forms 88574 and 95824) — **this is the client's own data sitting on a third
  party's server**, and it should be retrieved regardless of this project
- Brand assets: logo files, brand colours, typography if fixed
- Confirmed audience figures
