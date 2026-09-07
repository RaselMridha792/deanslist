# What could be built next

Feature proposals, not fixes. `SITE-AUDIT-IMPROVEMENTS.md` covers what is broken
or thin in what already exists; this covers what does not exist yet.

Written 7 September 2026. Nothing here has been built.

Everything is checked against the running site first, so nothing below proposes
something already there. Each item carries an honest effort estimate and, more
usefully, **what it is worth** — because a talent show's problems are not the
same as a shop's, and half the obvious ideas do not apply.

## The business, as the features see it

A weekly live talent show on Facebook. Performers send video, the audience
watches live and comments **FREEZE** to push the prize up or **PASS** to end an
act. Cash is paid on air. A separate Watch Party Contest runs alongside it. Meta
ads are about to drive registrations.

So there are only three numbers that matter, and every proposal below is scored
against one of them:

1. **Registrations** — performers in the pipeline
2. **Live viewers** — the audience that decides the prize, and the thing a
   sponsor is actually buying
3. **Trust** — whether a stranger believes the money is real

| | Count |
|---|---|
| Do first — closes a gap in something already running | 3 |
| High value, clear scope | 5 |
| Worth doing once there is volume | 4 |
| Considered and not recommended | 3 |

---

## 1. Do first — these close a gap in something already live

### 1.1 A way to actually enter the Watch Party Contest
**Effort: small · Drives: live viewers**

The Watch Party Contest is running on the site right now. It tells people to host
a party with at least five people, post photos during the show, and be voted on.
It gives them **no way to tell you they are doing it.** The only buttons on the
page go to YouTube and Facebook.

So the client cannot know who is hosting, cannot count the parties, cannot
contact a host, cannot follow up with the winner, and cannot prove the contest
ran. A campaign that captures nothing is a poster.

What it needs: a short form on the campaign page — host name, email, city, how
many people, which show. It is the same lead pipeline everything else uses, with
a new `LeadType` of `WATCH_PARTY` so parties can be segmented and emailed
separately from performers.

The wider point: **every campaign should be able to carry its own capture form.**
Add a field to the campaign row saying which form to show, and the next contest
the client invents gets a working entry mechanism without a developer.

### 1.2 A page for when the show is on
**Effort: small–medium · Drives: live viewers**

There is nowhere on the site that says "this is happening right now". Someone who
hears about the show mid-broadcast and types the domain in gets a homepage with a
countdown, which is the wrong thing at exactly the wrong moment.

A `/live` page that changes with the show's status: before, the countdown and a
reminder signup; during, the embedded Facebook stream, the FREEZE and PASS
explainer, and who is performing; after, the winner and the replay.

The status field on a show already exists, so the page can flip on its own. The
homepage hero can point at it whenever a show is LIVE.

### 1.3 Show reminders
**Effort: small · Drives: live viewers**

The newsletter sends when someone writes a campaign. Nothing sends automatically
before a broadcast, which is the one email with an obvious job: **get the person
who already said yes to actually turn up.**

"Remind me before the show" on the live page and the homepage, then an automatic
email an hour before the start time. The scheduler that would send it already
exists and already runs; it needs a reminder job and a show with a confirmed
start time.

Worth pairing with SMS later — see 3.4 — because a text an hour before a live
show is read and an email may not be.

---

## 2. High value, clear scope

### 2.1 Contestant status page
**Effort: medium · Drives: registrations, trust**

A performer registers and then hears nothing until a human emails them. They have
no way to check, so they email to ask, and every one of those is a person the
team has to answer.

A magic-link page — no password, a link mailed to the address they registered
with — showing where they are: received, under review, shortlisted, booked for a
date, or not selected this time. It doubles as the place they submit their video
link if they did not have one at registration.

This is also the honest version of a rejection. "Not selected this time, the next
show is open" retains someone who would otherwise assume they were ignored.

### 2.2 Per-episode pages
**Effort: medium · Drives: trust, search traffic**

Episodes exist in the database with a title, a number, an air date, a video and a
description, and the site only ever renders them as thumbnails that play. There
is no page per episode.

Each one is a page that can rank: "Crown the Sound episode 4", the performances,
who won, what they were paid. It is the cheapest content the client will ever
have, because **it already exists** — the episodes are recorded, the winners are
known, the videos are up.

It also gives the winner a place to link to, which matters for 2.3.

### 2.3 Performer profile pages
**Effort: medium · Drives: registrations, trust**

A page per performer: their name, their talent, their performances, what they
won. Not just winners — anyone who has been on.

The reason is distribution, not vanity. **A performer shares their own page in a
way they will never share yours.** Every act that has been on the show becomes a
person with a reason to post a link, and each of those links points at a page
that also says how to register.

Depends on getting permission and a photograph, which the site currently has for
nobody. Worth pairing with 2.1, where a contestant could upload their own.

### 2.4 Proof the money is real
**Effort: small · Drives: trust**

The single biggest objection to a cash-prize contest advertised on Facebook is
that it is a scam. The site currently answers this with one winner, no
photograph, and a prize figure.

What would answer it properly: a winners wall with payout dates, short quotes
from past performers, and the payout moment from each broadcast clipped and
embedded. None of this is development work — it is asking the client for material
that exists on their own channel and giving it a place to live.

This is the highest ratio of value to effort on this page, and it is bottlenecked
on the client, not on code.

### 2.5 Registration analytics in the dashboard
**Effort: medium · Drives: registrations**

Every lead now records the campaign, the creative and the click that produced it.
Nothing displays it. The dashboard shows counts and a list; the client cannot see
that `reel-variant-a` produced eleven registrations and `reel-variant-b` produced
one.

A single screen: registrations per day, split by campaign and creative, with
conversion rate from the landing page. It turns data that is already being
collected into the decision it was collected for.

---

## 3. Worth doing once there is volume

### 3.1 Filtering and search
**Effort: small**

Two shows, two winners, two campaigns, a handful of episodes — nothing to filter
yet. At a dozen episodes a viewer looking for last month's has to scroll the
whole grid. Filter the watch grid by show and the winners by season, when the
counts justify it.

### 3.2 Self-serve slot booking
**Effort: medium**

Once shortlisted, a performer picks from the available show dates themselves
instead of trading emails with the team. Only worth it when the team is
scheduling enough people that the emails hurt.

### 3.3 A show-day run sheet
**Effort: small–medium**

One dashboard screen for the person running the broadcast: tonight's running
order, each performer's name, talent, video link and phone number, in order, on
one page. Currently that is assembled by hand from the leads table before every
show.

### 3.4 SMS
**Effort: medium**

Phone numbers are already collected and there is already an `smsOptIn` field in
the validation layer that nothing uses. Two messages justify the cost: the
reminder an hour before a broadcast, and "you are on tonight" to a booked
performer. Both are time-critical, and both are read.

Adds a provider, a cost per message, and consent handling that is stricter than
email's.

---

## 4. Considered, and not recommended

Recorded so they are not re-proposed later.

### 4.1 On-site voting
The vote happens in the Facebook live chat, and that is the format — FREEZE and
PASS in the comments is the show. Building voting on the site would either
duplicate it or compete with it, and split the audience across two places on the
one night everything depends on them being in one.

### 4.2 A native mobile app
The audience is on Facebook and the performers arrive from an ad. An app is a
second thing to build, ship and maintain that solves no problem the site does not
already solve, and it puts a download between an ad click and a registration.

### 4.3 Paid entry or a membership tier
The site currently says in three places that entering is free, and that is the
strongest thing the ad has to say. Charging would need a rethink of the funnel
rather than a feature, and it is a business decision, not a technical one.

---

## If you only do three things

1. **A form on the Watch Party Contest.** A campaign is live and capturing
   nothing. Smallest job on this page and the only one fixing something already
   running.
2. **The `/live` page and show reminders.** Everything the show is worth depends
   on people being there when it starts, and nothing on the site currently helps
   with that.
3. **Proof the money is real.** Costs almost no development time and answers the
   objection that every ad click is silently making.

The first two are roughly a week together. The third is a conversation with the
client and an afternoon.
