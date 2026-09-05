"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The guided chat.
 *
 * Two modes in one thread. The flow is a five-step form wearing a conversation:
 * intent, name, email, an intent-specific detail, confirm — with the progress
 * shown, because an unbounded chat window with no end in sight is where people
 * stop typing. The server writes the Lead as soon as the email step passes, so
 * abandoning at step four still leaves the client a contactable person.
 *
 * Ask mode answers questions from the published knowledge base. It says so
 * plainly, and when it has no answer it offers the team's email rather than
 * improvising — every fact here is a claim about a public prize competition.
 */

type Step = "intent" | "name" | "email" | "detail" | "confirm";

type StepView = {
  step: Step;
  index: number;
  total: number;
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

type Bubble = { id: number; role: "assistant" | "user"; text: string };

type Answers = { intent?: string; name?: string; email?: string; detail?: string };

const MAX_CHARS = 600;

export function ChatTab({
  active,
  started,
  sessionId,
}: {
  active: boolean;
  started: boolean;
  sessionId: string | null;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [view, setView] = useState<StepView | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [mode, setMode] = useState<"flow" | "ask">("flow");
  const [flowDone, setFlowDone] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bootstrapped = useRef(false);
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  const push = useCallback((role: Bubble["role"], text: string) => {
    setBubbles((prev) => [...prev, { id: nextId.current++, role, text }]);
  }, []);

  const send = useCallback(
    async (payload: Record<string, unknown>): Promise<ChatResponse | null> => {
      if (!sessionId) return null;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            sessionId,
            hp: honeypotRef.current?.value ?? "",
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Partial<ChatResponse> & {
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "I could not reach the team's server. Try again?");
        }

        const reply = data as ChatResponse;
        push("assistant", reply.reply);
        setView(reply.view ?? null);
        setSuggestions(reply.suggestions ?? []);
        if (reply.done || reply.capped) setFlowDone(true);
        if (reply.view === null) setMode("ask");
        return reply;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [push, sessionId],
  );

  // The opening turn is requested once, the first time the tab is opened, so a
  // visitor who never touches Chat never creates a Conversation row.
  useEffect(() => {
    if (!started || !sessionId || bootstrapped.current) return;
    bootstrapped.current = true;
    void send({ kind: "start" }).then((res) => {
      // If the opening turn never arrived, leave a usable ask box rather than a
      // dead panel with no input in it.
      if (!res) setMode("ask");
    });
  }, [started, sessionId, send]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [bubbles.length, busy]);

  useEffect(() => {
    if (active && !busy) (lineRef.current ?? areaRef.current)?.focus();
  }, [active, busy, view?.step, mode]);

  /* ------------------------------------------------------------- handlers */

  async function choose(value: string, label: string) {
    if (busy) return;
    push("user", label);
    setAnswers((a) => ({ ...a, intent: value }));
    await send({ kind: "step", step: "intent", value, answers: { ...answers, intent: value } });
  }

  async function submitFlow(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !view) return;

    const value = draft.trim();
    if (!value && !view.optional) return;

    const key = view.step === "name" ? "name" : view.step === "email" ? "email" : "detail";
    const merged = { ...answers, [key]: value };

    if (value) push("user", value);
    setAnswers(merged);
    setDraft("");
    await send({ kind: "step", step: view.step, value, answers: merged });
  }

  async function confirmFlow() {
    if (busy) return;
    push("user", optIn ? "Send it, and keep me posted" : "Send it");
    await send({ kind: "step", step: "confirm", value: "yes", optIn, answers });
  }

  async function ask(question: string) {
    const trimmed = question.trim();
    if (busy || !trimmed) return;
    push("user", trimmed);
    setDraft("");
    await send({ kind: "ask", message: trimmed.slice(0, MAX_CHARS) });
  }

  /* ---------------------------------------------------------------- render */

  const showFlow = mode === "flow" && view !== null;

  return (
    <div className="flex h-full flex-col">
      {showFlow && (
        <div className="shrink-0 px-5 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-eyebrow font-semibold uppercase tracking-widest text-chalk-faint">
              Step {view.index + 1} of {view.total}
            </p>
            {!flowDone && (
              <button
                type="button"
                onClick={() => setMode("ask")}
                className="text-eyebrow font-semibold uppercase tracking-widest text-chalk-faint transition-colors duration-base ease-crisp hover:text-brand"
              >
                Ask instead
              </button>
            )}
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: view.total }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors duration-base ease-crisp",
                  i <= view.index ? "bg-brand-gloss" : "bg-ink-line",
                )}
              />
            ))}
          </div>
        </div>
      )}

      {mode === "ask" && (
        <div className="shrink-0 border-b border-ink-line px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-chalk-faint">
              Answers come from what the team has published.
            </p>
            {!flowDone && view && (
              <button
                type="button"
                onClick={() => setMode("flow")}
                className="shrink-0 text-eyebrow font-semibold uppercase tracking-widest text-chalk-faint transition-colors duration-base ease-crisp hover:text-brand"
              >
                Back to form
              </button>
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {bubbles.map((b) => (
          <p
            key={b.id}
            className={cn(
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
              b.role === "assistant"
                ? "border border-ink-line bg-ink-raised text-chalk-body"
                : "ml-auto border border-brand/30 bg-brand/10 text-chalk",
            )}
          >
            {b.text}
          </p>
        ))}

        {busy && (
          <p className="max-w-[85%] rounded-2xl border border-ink-line bg-ink-raised px-4 py-2.5 text-sm text-chalk-faint">
            <span className="sr-only">Working on it</span>
            <span aria-hidden="true">…</span>
          </p>
        )}

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        {mode === "ask" && !busy && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="rounded-full border border-ink-edge bg-ink-high px-3 py-1.5 text-xs text-chalk-muted transition-colors duration-base ease-crisp hover:border-brand hover:text-brand"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-ink-line bg-ink-raised px-5 py-4">
        <input
          ref={honeypotRef}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute h-0 w-0 overflow-hidden opacity-0"
        />

        {showFlow && view.input === "choice" && (
          <div className="grid gap-2">
            {(view.choices ?? []).map((c) => (
              <button
                key={c.value}
                type="button"
                disabled={busy}
                onClick={() => void choose(c.value, c.label)}
                className="card-interactive px-4 py-3 text-left disabled:opacity-50"
              >
                <span className="block text-sm font-medium text-chalk">{c.label}</span>
                {c.hint && <span className="block text-xs text-chalk-faint">{c.hint}</span>}
              </button>
            ))}
          </div>
        )}

        {showFlow && (view.input === "text" || view.input === "email") && (
          <form onSubmit={submitFlow} className="flex gap-2" noValidate>
            <label className="sr-only" htmlFor="dl-chat-input">
              {view.label}
            </label>
            <input
              id="dl-chat-input"
              ref={lineRef}
              type={view.input === "email" ? "email" : "text"}
              inputMode={view.input === "email" ? "email" : "text"}
              autoComplete={view.input === "email" ? "email" : "given-name"}
              value={draft}
              maxLength={MAX_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={view.placeholder}
              className="field"
            />
            <button type="submit" disabled={busy} className="btn btn-primary !px-5 disabled:opacity-50">
              Next
            </button>
          </form>
        )}

        {showFlow && view.input === "textarea" && (
          <form onSubmit={submitFlow} className="grid gap-2" noValidate>
            <label className="sr-only" htmlFor="dl-chat-detail">
              {view.label}
            </label>
            <textarea
              id="dl-chat-detail"
              ref={areaRef}
              rows={3}
              value={draft}
              maxLength={MAX_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={view.placeholder}
              className="field resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="btn btn-primary flex-1 disabled:opacity-50"
              >
                {draft.trim() ? "Continue" : "Skip"}
              </button>
            </div>
          </form>
        )}

        {showFlow && view.input === "confirm" && (
          <div className="grid gap-3">
            <label className="flex items-start gap-3 text-xs text-chalk-muted">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>Email me show announcements and reminders. One click to unsubscribe.</span>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmFlow()}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              Send to the team
            </button>
          </div>
        )}

        {mode === "ask" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(draft);
            }}
            className="flex gap-2"
            noValidate
          >
            <label className="sr-only" htmlFor="dl-chat-ask">
              Ask a question
            </label>
            <input
              id="dl-chat-ask"
              ref={lineRef}
              value={draft}
              maxLength={MAX_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about entering, the shows, anything"
              className="field"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="btn btn-primary !px-5 disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
