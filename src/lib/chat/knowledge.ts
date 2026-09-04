import { prisma } from "@/lib/prisma";

/**
 * The chatbot's only source of fact.
 *
 * Everything the assistant is allowed to say about the contest comes from active
 * KnowledgeItem rows. This module does two jobs:
 *
 *   1. loads and caches those rows, so the team can change what the bot knows
 *      from the dashboard without a deploy (Phase 8 "done when");
 *   2. retrieves the relevant ones by keyword, with no model involved.
 *
 * (2) is deliberately the primary path, not a degraded one. With no
 * ANTHROPIC_API_KEY set the widget still answers real questions from this
 * matcher alone, which means the client can run the whole engagement centre at
 * zero marginal cost, and a model outage or a spent daily budget downgrades the
 * experience instead of breaking it.
 */

export type KnowledgeEntry = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
};

export type KnowledgeMatch = {
  entry: KnowledgeEntry;
  score: number;
};

/**
 * Short TTL rather than a permanent cache: an edit in the admin console shows up
 * within a minute, and a busy conversation does not hit Postgres per message.
 */
const CACHE_TTL_MS = 60_000;
const MAX_ITEMS = 300;

let cache: { at: number; items: KnowledgeEntry[] } | null = null;

export async function loadKnowledge(): Promise<KnowledgeEntry[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.items;

  try {
    const rows = await prisma.knowledgeItem.findMany({
      where: { active: true },
      orderBy: { updatedAt: "desc" },
      take: MAX_ITEMS,
      select: { id: true, question: true, answer: true, category: true },
    });
    cache = { at: now, items: rows };
    return rows;
  } catch (err) {
    // A database blip must not take the widget down. Serve the last good copy;
    // an empty list makes the bot say it cannot answer, which is still honest.
    console.error("[chat] knowledge load failed:", err);
    return cache?.items ?? [];
  }
}

/** Drops the cache immediately. For the admin console after a knowledge edit. */
export function invalidateKnowledgeCache() {
  cache = null;
}

/* ----------------------------------------------------------------- matching */

const STOPWORDS = new Set([
  "a", "about", "after", "all", "am", "an", "and", "any", "are", "as", "at",
  "be", "been", "before", "being", "but", "by", "can", "could", "did", "do", "does",
  "doing", "for", "from", "get", "got", "had", "has", "have", "he", "her", "here",
  "him", "his", "how", "i", "if", "in", "into", "is", "it", "its", "just",
  "like", "me", "much", "my", "no", "not", "of", "on", "or", "our", "out", "please",
  "she", "should", "so", "some", "tell", "than", "that", "the", "their", "them",
  "then", "there", "these", "they", "this", "to", "too", "us", "very", "want",
  "was", "we", "were", "what", "which", "who", "will", "with", "would", "you", "your",
]);

/**
 * Word families, not a thesaurus. A visitor asking "is it free" and a knowledge
 * item titled "Does it cost anything to enter?" have no word in common, which is
 * exactly the case a naive keyword matcher fails and a support inbox pays for.
 */
const SYNONYM_GROUPS: string[][] = [
  ["enter", "entry", "entries", "apply", "application", "signup", "sign", "register",
    "registration", "audition", "submit", "submission", "compete", "competing", "contestant"],
  ["cost", "costs", "free", "fee", "fees", "price", "pay", "payment", "charge", "paid"],
  ["prize", "prizes", "money", "cash", "win", "winner", "winning", "award", "reward", "pot"],
  ["show", "shows", "episode", "episodes", "event", "events", "broadcast", "stream", "live"],
  ["date", "dates", "when", "time", "times", "schedule", "upcoming", "next", "start", "starts"],
  ["contact", "email", "reach", "support", "help", "human", "someone", "team", "talk", "speak"],
  ["rule", "rules", "eligibility", "eligible", "age", "old", "requirement", "requirements",
    "terms", "allowed"],
  ["vote", "votes", "voting", "audience", "viewers", "freeze", "pass"],
  ["watch", "video", "videos", "youtube", "facebook", "channel", "channels"],
  ["sponsor", "sponsors", "sponsorship", "brand", "brands", "partner", "partnership", "advertise"],
  ["judge", "judges", "crew", "host", "hosts", "volunteer", "staff"],
  ["talent", "sing", "singer", "singing", "rap", "rapper", "dance", "dancer", "musician", "dj", "chef"],
  ["deanslist", "deans", "dean", "list"],
];

const SYNONYMS: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    for (const word of group) {
      const existing = map.get(word) ?? new Set<string>();
      for (const other of group) if (other !== word) existing.add(other);
      map.set(word, existing);
    }
  }
  return map;
})();

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Crude singular fold. Good enough here, and it never needs a dependency. */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("es") && !token.endsWith("ses")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokenise(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of normalise(text).split(" ")) {
    if (!raw || raw.length < 2 || STOPWORDS.has(raw)) continue;
    seen.add(stem(raw));
  }
  return [...seen];
}

const QUESTION_WEIGHT = 1;
const ANSWER_WEIGHT = 0.55;
const CATEGORY_WEIGHT = 0.4;
const SYNONYM_DISCOUNT = 0.8;
const PHRASE_BONUS = 0.12;

/** At or above this, answer straight from the item. */
export const STRONG_MATCH = 0.7;
/** Below this, treat it as no match at all and offer the handoff. */
export const MIN_MATCH = 0.34;

function weightFor(
  term: string,
  question: Set<string>,
  answer: Set<string>,
  category: Set<string>,
): number {
  if (question.has(term)) return QUESTION_WEIGHT;
  if (answer.has(term)) return ANSWER_WEIGHT;
  if (category.has(term)) return CATEGORY_WEIGHT;
  return 0;
}

/**
 * Ranks knowledge items against a visitor question. Returns at most `limit`
 * entries scored 0..1, best first. Never throws, never calls out to anything.
 */
export function searchKnowledge(
  query: string,
  items: KnowledgeEntry[],
  limit = 4,
): KnowledgeMatch[] {
  const terms = tokenise(query);
  if (terms.length === 0 || items.length === 0) return [];

  const normalisedQuery = normalise(query);

  // Every word the question could be asking about, so an item can be scored on
  // how much of *it* the visitor asked for, not only the other way round.
  const asked = new Set<string>(terms);
  for (const term of terms) {
    for (const alt of SYNONYMS.get(term) ?? []) asked.add(stem(alt));
  }

  const scored = items.map((entry) => {
    const question = new Set(tokenise(entry.question));
    const answer = new Set(tokenise(entry.answer));
    const category = new Set(tokenise(entry.category ?? ""));

    let matched = 0;
    let total = 0;

    for (const term of terms) {
      let best = weightFor(term, question, answer, category);
      if (best === 0) {
        for (const alt of SYNONYMS.get(term) ?? []) {
          const w = weightFor(stem(alt), question, answer, category) * SYNONYM_DISCOUNT;
          if (w > best) best = w;
        }
      }
      if (best > 0) matched += 1;
      total += best;
    }

    const coverage = matched / terms.length;
    const weighted = total / terms.length;

    // How specific this item is to what was asked. Without it, "How do I enter?"
    // and "Does it cost anything to enter?" both score a perfect coverage on the
    // single word "enter", and the tie is broken by row order — which is how a
    // matcher ends up answering the fee question when someone asks how to enter.
    const precision = question.size
      ? [...question].filter((t) => asked.has(t)).length / question.size
      : 0;

    let score = coverage * 0.5 + weighted * 0.33 + precision * 0.17;

    // Whole-question containment, e.g. "how do i enter" inside "How do I enter?".
    if (normalisedQuery.length > 8 && normalise(entry.question).includes(normalisedQuery)) {
      score += PHRASE_BONUS;
    }

    return { entry, score: Math.min(1, Number(score.toFixed(4))) };
  });

  return scored
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* -------------------------------------------------------------- small talk */

/**
 * Greetings and meta questions. Not contest facts, so they are safe to answer
 * without the knowledge base, and they save a model call on the most common
 * opening message any widget ever receives.
 */
const SMALL_TALK: { test: RegExp; reply: string }[] = [
  {
    test: /^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/i,
    reply:
      "Hello. Ask me anything about the Dean's List, or use the quick form and I will pass your details straight to the team.",
  },
  {
    test: /\b(thanks|thank you|cheers|appreciate it)\b/i,
    reply: "Any time. Anything else you want to know?",
  },
  {
    test: /\b(bye|goodbye|see ya|later)\b/i,
    reply: "Thanks for stopping by. The entry form is on the first tab whenever you are ready.",
  },
  {
    test: /\b(who|what) are you\b|\bare you (a )?(bot|robot|human|real|ai)\b/i,
    reply:
      "I am the Dean's List website assistant, not a person. I answer from what the team has published, and I pass anything else to them.",
  },
  {
    test: /\bwhat can you (do|help)\b|\bhow can you help\b/i,
    reply:
      "I can answer published questions about the shows and entering, take your entry, and pass anything I cannot answer to the team.",
  },
];

export function matchSmallTalk(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 60) return null;
  for (const item of SMALL_TALK) if (item.test.test(trimmed)) return item.reply;
  return null;
}

/* ------------------------------------------------------------ compositions */

/**
 * Up to `n` published questions, shown as starter chips so the widget advertises
 * what it actually knows instead of inviting questions it cannot answer.
 */
export function suggestedQuestions(items: KnowledgeEntry[], n = 4): string[] {
  return items.slice(0, n).map((i) => i.question);
}

export type KnowledgeAnswer = {
  text: string;
  confident: boolean;
  /** The items behind the answer, and the only grounding a model reply may use. */
  used: KnowledgeEntry[];
};

/**
 * The model-free answer. Also the fallback whenever the model path is disabled,
 * rate limited, over budget, unreachable, or produces a reply the guard rejects.
 */
export function answerFromKnowledge(
  matches: KnowledgeMatch[],
): KnowledgeAnswer | null {
  const best = matches[0];
  if (!best || best.score < MIN_MATCH) return null;

  if (best.score >= STRONG_MATCH) {
    return { text: best.entry.answer, confident: true, used: [best.entry] };
  }

  return {
    text: `I am not certain that is what you meant, but here is the closest thing I have. ${best.entry.answer}`,
    confident: false,
    used: [best.entry],
  };
}
