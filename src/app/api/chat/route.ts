import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { chatEnabled } from "@/lib/env";
import { SITE } from "@/content/site";
import {
  answerFromKnowledge,
  loadKnowledge,
  matchSmallTalk,
  searchKnowledge,
  suggestedQuestions,
  MIN_MATCH,
  type KnowledgeEntry,
} from "@/lib/chat/knowledge";
import {
  askModel,
  clientIp,
  handoffReply,
  sanitiseUserText,
  screenReply,
  CHAT_LIMITS,
  type RecentTurn,
} from "@/lib/chat/guard";

/**
 * The engagement centre's server half.
 *
 * This is a public, unauthenticated endpoint that can spend the client's money,
 * so it is built in that order: the free path first, the paid path as an opt-in
 * enhancement behind limits.
 *
 *   - With no ANTHROPIC_API_KEY the widget is fully functional. Free-form
 *     questions are answered by keyword match over active KnowledgeItem rows,
 *     and the guided flow — which is where the leads come from — never needed a
 *     model at all.
 *   - With a key, the model is called only in the narrow band where the keyword
 *     matcher found relevant items but is not confident which one answers the
 *     question. A confident match is served verbatim: cheaper, faster, and it
 *     cannot hallucinate.
 *   - Nothing reaches the visitor without passing screenReply(), which rejects
 *     any number — digits or words — currency, month, weekday, eligibility term
 *     or link that is not present in the knowledge items the model was given.
 *
 * Defences: honeypot, per-IP and per-session rate limits (keyed on the proxy's
 * view of the address, never the client's — see clientIp in guard.ts), a
 * separate and much tighter limit on model calls, a request-body size cap, a
 * per-conversation message ceiling, a per-reply output token cap, and a daily
 * token ceiling (see src/lib/chat/guard.ts).
 *
 * Trust boundary: a session id is an anonymous, unverified string. It buys the
 * bearer their own conversation and the lead row that conversation created —
 * nothing else. No step reads stored contact detail back to the caller, and no
 * lead that the chatbot did not write is ever adopted, edited or echoed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------- shape */

const STEPS = ["intent", "name", "email", "detail", "confirm"] as const;
type Step = (typeof STEPS)[number];

const INTENTS = ["contestant", "fan", "sponsor", "support"] as const;
type Intent = (typeof INTENTS)[number];

const sessionId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, "Bad session id");

const answersSchema = z
  .object({
    intent: z.enum(INTENTS).optional(),
    name: z.string().max(80).optional(),
    email: z.string().max(160).optional(),
    detail: z.string().max(CHAT_LIMITS.maxMessageChars).optional(),
  })
  .default({});

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("start"),
    sessionId,
    hp: z.string().optional(),
  }),
  z.object({
    kind: z.literal("step"),
    sessionId,
    hp: z.string().optional(),
    step: z.enum(STEPS),
    value: z.string().max(CHAT_LIMITS.maxMessageChars).default(""),
    optIn: z.boolean().optional(),
    answers: answersSchema,
  }),
  z.object({
    kind: z.literal("ask"),
    sessionId,
    hp: z.string().optional(),
    message: z.string().min(1).max(CHAT_LIMITS.maxMessageChars),
  }),
]);

type StepView = {
  step: Step;
  index: number;
  total: number;
  /** Accessible label for the control. The conversational copy is in `reply`. */
  label: string;
  input: "choice" | "text" | "email" | "textarea" | "confirm";
  choices?: { value: string; label: string; hint?: string }[];
  placeholder?: string;
  optional?: boolean;
};

type ChatResponse = {
  ok: true;
  reply: string;
  view: StepView | null;
  source: "flow" | "knowledge" | "model" | "smalltalk" | "none";
  leadCaptured?: boolean;
  handoff?: boolean;
  done?: boolean;
  capped?: boolean;
  suggestions?: string[];
};

/* -------------------------------------------------------------------- flow */

const INTENT_CHOICES = [
  { value: "contestant", label: "I want to compete", hint: "Enter the contest" },
  { value: "fan", label: "I am a fan", hint: "Shows, results and reminders" },
  { value: "sponsor", label: "Sponsorship", hint: "Brands and partners" },
  { value: "support", label: "Something else", hint: "Ask the team" },
];

const DETAIL_PROMPT: Record<Intent, string> = {
  contestant:
    "What is your act, and do you have a link to a performance? Paste it here and the team can watch it straight away.",
  fan: "What would you like to hear about — new episodes, results, or both?",
  sponsor: "Tell me about your brand and what you are looking for from a season.",
  support: "What do you need help with? I will pass it to the team with your details.",
};

const DETAIL_PLACEHOLDER: Record<Intent, string> = {
  contestant: "Singer — https://youtube.com/watch?v=...",
  fan: "Remind me before each live show",
  sponsor: "Brand, budget, what you want to reach",
  support: "Your question",
};

const CLOSING: Record<Intent, string> = {
  contestant:
    "That is with the team. If you have not finished a full entry yet, the Entry tab takes your performance link and category in under a minute.",
  fan: "You are on the list. Announcements and reminders go out by email before each show.",
  sponsor: "Thank you — the team handles sponsorship directly and will reply to you by email.",
  support: "Thank you. The team will come back to you by email.",
};

const LEAD_TYPE: Record<Intent, "CONTESTANT" | "FAN" | "SPONSOR" | "GENERAL"> = {
  contestant: "CONTESTANT",
  fan: "FAN",
  sponsor: "SPONSOR",
  support: "GENERAL",
};

function viewFor(step: Step, intent: Intent): StepView {
  const index = STEPS.indexOf(step);
  const base = { step, index, total: STEPS.length };

  switch (step) {
    case "intent":
      return { ...base, label: "What brings you here?", input: "choice", choices: INTENT_CHOICES };
    case "name":
      return { ...base, label: "Your first name", input: "text", placeholder: "First name" };
    case "email":
      return { ...base, label: "Your email address", input: "email", placeholder: "you@email.com" };
    case "detail":
      return {
        ...base,
        label: DETAIL_PROMPT[intent],
        input: "textarea",
        placeholder: DETAIL_PLACEHOLDER[intent],
        optional: true,
      };
    case "confirm":
      return { ...base, label: "Send this to the team", input: "confirm" };
  }
}

/* ----------------------------------------------------------------- helpers */

/**
 * The conversation owned by this session id, created on first contact.
 *
 * `sessionId` is the only thing that addresses a conversation, so it is selected
 * back out and re-checked before anything is written: every mutation below acts
 * on the row this session owns, never on one named by a different request.
 */
async function getConversation(sid: string, ip: string) {
  return prisma.conversation.upsert({
    where: { sessionId: sid },
    create: { sessionId: sid, ipAddress: ip },
    update: {},
    select: { id: true, sessionId: true, leadId: true, intent: true, handedOff: true },
  });
}

/**
 * The Lead row this conversation created, or null.
 *
 * Every lead write in this file goes through here. `conversation.leadId` on its
 * own is not enough: the row also has to be one the chatbot itself wrote, so a
 * link left by an older build — or by anything other than this flow — can never
 * be edited or read back by an anonymous visitor holding a session id.
 */
async function ownedLeadId(leadId: string | null): Promise<string | null> {
  if (!leadId) return null;
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, source: "CHATBOT" },
    select: { id: true },
  });
  return lead?.id ?? null;
}

async function say(conversationId: string, role: "user" | "assistant", content: string) {
  if (!content) return;
  await prisma.message.create({
    data: { conversationId, role, content: content.slice(0, 2000) },
  });
}

function splitName(full: string): { firstName: string; lastName?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const firstName = (parts.shift() ?? "there").slice(0, 80);
  const lastName = parts.join(" ").slice(0, 80);
  return { firstName, lastName: lastName || undefined };
}

/**
 * Writes the Lead the moment an email exists, before the flow is finished.
 *
 * This is the whole point of the guided chat: an abandoned conversation still
 * leaves the client a contactable person. The old site's third-party form leaked
 * every one of these.
 *
 * It never adopts an existing Lead by email. The address arriving here is
 * anonymous and unverified — anyone can type a contestant's — so matching on it
 * would let a visitor attach their conversation to somebody else's record and
 * then overwrite the name, append to the message and flip the marketing consent
 * on it. A chatbot capture always writes its OWN row, `source: CHATBOT`. If that
 * address is already in the table, that is a duplicate for the team to merge in
 * the dashboard: merging two identities is an editorial decision, not something
 * an anonymous visitor gets to trigger.
 */
async function captureLead(args: {
  conversationId: string;
  existingLeadId: string | null;
  intent: Intent;
  name: string;
  email: string;
  ip: string;
  userAgent?: string;
  referrer?: string;
}): Promise<string> {
  // The name rides in on the request body rather than the current step's value,
  // so it is cleaned here too: it is stored, and the dashboard renders it.
  const name = sanitiseUserText(args.name, 80);
  const named = name.trim().length >= 2;
  const { firstName, lastName } = named
    ? splitName(name)
    : { firstName: "Friend", lastName: undefined };
  const email = args.email.trim().toLowerCase();

  // The row this conversation already wrote, if it wrote one. Correcting it in
  // place is safe — we made it — and it keeps a corrected typo from leaving an
  // orphan row behind. Anything this conversation does not own falls through to
  // a fresh insert.
  const owned = await ownedLeadId(args.existingLeadId);

  if (owned) {
    await prisma.lead.update({
      where: { id: owned },
      data: named ? { firstName, lastName, email } : { email },
    });
    return owned;
  }

  const lead = await prisma.lead.create({
    data: {
      type: LEAD_TYPE[args.intent],
      source: "CHATBOT",
      firstName,
      lastName,
      email,
      ipAddress: args.ip,
      userAgent: args.userAgent,
      referrer: args.referrer,
    },
    select: { id: true },
  });

  await prisma.conversation.update({
    where: { id: args.conversationId },
    data: { leadId: lead.id },
  });

  return lead.id;
}

function json(body: ChatResponse, status = 200) {
  return NextResponse.json(body, { status });
}

/* -------------------------------------------------------------------- POST */

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const declaredSize = Number(req.headers.get("content-length") ?? 0);
  if (declaredSize > CHAT_LIMITS.maxRequestBytes) {
    return NextResponse.json({ error: "Message too large" }, { status: 413 });
  }

  if (!rateLimit(`chat:ip:${ip}`, 40, 5 * 60_000).ok) {
    return NextResponse.json(
      { error: "You are sending messages very quickly. Give it a moment." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  // Honeypot. A person never sees the field, so a value means a bot: answer
  // like nothing happened and write nothing to the database.
  if (body.hp) {
    return json({ ok: true, reply: "Thanks.", view: null, source: "none" });
  }

  if (!rateLimit(`chat:sess:${body.sessionId}`, 30, 5 * 60_000).ok) {
    return NextResponse.json({ error: "Too many messages in this chat." }, { status: 429 });
  }

  let conversation;
  try {
    conversation = await getConversation(body.sessionId, ip);
  } catch (err) {
    console.error("[chat] conversation load failed:", err);
    return NextResponse.json({ error: "Chat is unavailable right now." }, { status: 503 });
  }

  // The row is looked up by session id, so this holds by construction. It is
  // asserted anyway because every write below trusts it: a conversation may only
  // ever be mutated by the session that owns it.
  if (conversation.sessionId !== body.sessionId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 403 });
  }

  const messageCount = await prisma.message.count({
    where: { conversationId: conversation.id },
  });

  if (messageCount >= CHAT_LIMITS.maxMessagesPerConversation) {
    return json({
      ok: true,
      capped: true,
      handoff: true,
      source: "none",
      view: null,
      reply: `We have covered a lot here. Email the team at ${SITE.email} and they will pick it up directly.`,
    });
  }

  try {
    if (body.kind === "start") return await handleStart(conversation.id);
    if (body.kind === "step") {
      return await handleStep({
        conversation,
        sessionId: body.sessionId,
        step: body.step,
        value: body.value,
        optIn: body.optIn === true,
        answers: body.answers,
        ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
        referrer: req.headers.get("referer") ?? undefined,
      });
    }
    return await handleAsk({
      conversationId: conversation.id,
      sessionId: body.sessionId,
      ip,
      question: body.message,
    });
  } catch (err) {
    console.error("[chat] handler failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ start */

async function handleStart(conversationId: string) {
  const items = await loadKnowledge();
  const reply =
    "Hi. I can take your details straight to the team, or answer what we have published. What brings you here?";

  await say(conversationId, "assistant", reply);

  return json({
    ok: true,
    reply,
    view: viewFor("intent", "support"),
    source: "flow",
    suggestions: suggestedQuestions(items, 3),
  });
}

/* ------------------------------------------------------------------- step */

type StepArgs = {
  conversation: { id: string; sessionId: string; leadId: string | null; intent: string | null };
  sessionId: string;
  step: Step;
  value: string;
  optIn: boolean;
  answers: z.infer<typeof answersSchema>;
  ip: string;
  userAgent?: string;
  referrer?: string;
};

async function handleStep(args: StepArgs) {
  const { conversation } = args;

  // Every step handler below is independently reachable, and each one writes.
  // None of them runs against a conversation this request does not own.
  if (conversation.sessionId !== args.sessionId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 403 });
  }

  const value = sanitiseUserText(args.value);

  const intent: Intent = INTENTS.includes(args.answers.intent as Intent)
    ? (args.answers.intent as Intent)
    : INTENTS.includes(conversation.intent as Intent)
      ? (conversation.intent as Intent)
      : "support";

  switch (args.step) {
    /* ---------------------------------------------------------- 1. intent */
    case "intent": {
      if (!INTENTS.includes(value as Intent)) {
        return json({
          ok: true,
          reply: "Pick whichever is closest and we can refine it after.",
          view: viewFor("intent", "support"),
          source: "flow",
        });
      }
      const chosen = value as Intent;
      const label = INTENT_CHOICES.find((c) => c.value === chosen)?.label ?? chosen;

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { intent: chosen },
      });
      await say(conversation.id, "user", label);

      const reply =
        chosen === "contestant"
          ? "Good — let us get you in front of the judges. What should I call you?"
          : chosen === "sponsor"
            ? "Glad to hear it. What should I call you?"
            : chosen === "fan"
              ? "Welcome. What should I call you?"
              : "Happy to help. What should I call you?";

      await say(conversation.id, "assistant", reply);
      return json({ ok: true, reply, view: viewFor("name", chosen), source: "flow" });
    }

    /* ------------------------------------------------------------ 2. name */
    case "name": {
      if (value.length < 2) {
        return json({
          ok: true,
          reply: "I just need something to call you — a first name is plenty.",
          view: viewFor("name", intent),
          source: "flow",
        });
      }
      await say(conversation.id, "user", value);
      const { firstName } = splitName(value);
      const reply = `Thanks, ${firstName}. What is the best email address for you?`;
      await say(conversation.id, "assistant", reply);
      return json({ ok: true, reply, view: viewFor("email", intent), source: "flow" });
    }

    /* ----------------------------------------------------------- 3. email */
    case "email": {
      const email = z.string().email().max(160).safeParse(value.trim());
      if (!email.success) {
        return json({
          ok: true,
          reply: "That does not look like a working email. Mind checking it?",
          view: viewFor("email", intent),
          source: "flow",
        });
      }

      await say(conversation.id, "user", email.data);

      // Writing a Lead is the one thing this endpoint does that reaches the
      // client's inbox, so it gets its own limit — otherwise the general chat
      // allowance would let a script insert rows faster than /api/leads does.
      // A real person only passes this step once or twice.
      if (!rateLimit(`chat:lead:${args.ip}`, 5, 10 * 60_000).ok) {
        return json({
          ok: true,
          reply: `I could not save that just now. Email the team at ${SITE.email} and they will pick it up.`,
          view: null,
          source: "none",
          handoff: true,
        });
      }

      // The lead is written here, four questions in, not at the end. An
      // abandoned conversation still leaves a contactable person behind.
      await captureLead({
        conversationId: conversation.id,
        existingLeadId: conversation.leadId,
        intent,
        name: args.answers.name ?? "",
        email: email.data,
        ip: args.ip,
        userAgent: args.userAgent,
        referrer: args.referrer,
      });

      const reply = `Got it. ${DETAIL_PROMPT[intent]}`;
      await say(conversation.id, "assistant", reply);
      return json({
        ok: true,
        reply,
        view: viewFor("detail", intent),
        source: "flow",
        leadCaptured: true,
      });
    }

    /* ---------------------------------------------------------- 4. detail */
    case "detail": {
      if (value) await say(conversation.id, "user", value);

      const leadId = await ownedLeadId(conversation.leadId);

      if (leadId && value) {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { message: true },
        });
        const previous = lead?.message?.trim();
        await prisma.lead.update({
          where: { id: leadId },
          data: { message: previous ? `${previous}\n\n[chat] ${value}` : value },
        });
      }

      // Confirm with what the visitor typed in this exchange, and nothing else.
      // Reading the stored contact detail back would hand one person's name and
      // address to anyone who supplies their session id — a lookup oracle, in a
      // widget with no authentication at all. Echoing the request's own answers
      // tells the sender nothing they did not just send.
      const typedName = sanitiseUserText(args.answers.name ?? "", 80);
      const typedEmail = sanitiseUserText(args.answers.email ?? "", 160).toLowerCase();

      const heard: string[] = [];
      if (typedName.trim().length >= 2) heard.push(splitName(typedName).firstName);
      if (z.string().email().safeParse(typedEmail).success) heard.push(typedEmail);
      const summary = heard.length ? ` I have ${heard.join(" at ")}.` : "";

      const reply = value
        ? `Noted.${summary} Send this to the team now?`
        : `No problem, you can add that later.${summary} Send this to the team now?`;
      await say(conversation.id, "assistant", reply);
      return json({ ok: true, reply, view: viewFor("confirm", intent), source: "flow" });
    }

    /* --------------------------------------------------------- 5. confirm */
    case "confirm": {
      await say(conversation.id, "user", "Send it");

      if (args.optIn) {
        const leadId = await ownedLeadId(conversation.leadId);
        if (leadId) {
          await prisma.lead.update({
            where: { id: leadId },
            data: { marketingOptIn: true, consentAt: new Date() },
          });
        }
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { resolved: true },
      });

      const reply = `${CLOSING[intent]} Ask me anything else while you are here.`;
      await say(conversation.id, "assistant", reply);

      const items = await loadKnowledge();
      return json({
        ok: true,
        reply,
        view: null,
        done: true,
        source: "flow",
        suggestions: suggestedQuestions(items, 3),
      });
    }
  }
}

/* -------------------------------------------------------------------- ask */

async function handleAsk(args: {
  conversationId: string;
  sessionId: string;
  ip: string;
  question: string;
}) {
  const question = sanitiseUserText(args.question);
  if (!question) {
    return NextResponse.json({ error: "Say a little more" }, { status: 400 });
  }

  await say(args.conversationId, "user", question);

  const small = matchSmallTalk(question);
  if (small) {
    await say(args.conversationId, "assistant", small);
    return json({ ok: true, reply: small, view: null, source: "smalltalk" });
  }

  const items = await loadKnowledge();
  const matches = searchKnowledge(question, items);
  const fromKnowledge = answerFromKnowledge(matches);

  let text: string | null = null;
  let source: ChatResponse["source"] = "none";

  if (fromKnowledge?.confident) {
    // Deterministic, free, and incapable of inventing a fact. Preferred whenever
    // the matcher is sure, whether or not a model is configured.
    text = fromKnowledge.text;
    source = "knowledge";
  } else if (chatEnabled && matches.length > 0 && matches[0].score >= MIN_MATCH) {
    // The ambiguous band: relevant items exist but none of them clearly answers
    // the question as asked. This is the only place the paid path is used, and
    // it is gated again on its own much tighter limits.
    const modelAllowed =
      rateLimit(`chat:model:ip:${args.ip}`, 10, 5 * 60_000).ok &&
      rateLimit(`chat:model:sess:${args.sessionId}`, 12, 30 * 60_000).ok;

    if (modelAllowed) {
      const grounding: KnowledgeEntry[] = matches
        .filter((m) => m.score >= MIN_MATCH * 0.6)
        .slice(0, 4)
        .map((m) => m.entry);

      const recent: RecentTurn[] = (
        await prisma.message.findMany({
          where: { conversationId: args.conversationId },
          orderBy: { createdAt: "desc" },
          take: CHAT_LIMITS.recentTurnsForContext + 1,
          select: { role: true, content: true },
        })
      )
        .slice(1) // drop the question we just stored
        .reverse();

      const result = await askModel(question, grounding, recent);

      if (result.ok) {
        const screened = screenReply(result.text, grounding);
        if (screened.ok) {
          text = screened.text;
          source = "model";
        } else {
          // The model said something the knowledge base does not support. This
          // is the line between a helpful assistant and a legal problem.
          console.warn(`[chat] reply rejected by guard: ${screened.reason}`);
        }
      }
    }
  }

  if (!text && fromKnowledge) {
    text = fromKnowledge.text;
    source = "knowledge";
  }

  if (!text) {
    text = handoffReply();
    source = "none";
    await prisma.conversation.update({
      where: { id: args.conversationId },
      data: { handedOff: true },
    });
  }

  await say(args.conversationId, "assistant", text);

  return json({
    ok: true,
    reply: text,
    view: null,
    source,
    handoff: source === "none",
    suggestions: source === "none" ? suggestedQuestions(items, 3) : undefined,
  });
}
