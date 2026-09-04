"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { EntryTab } from "@/components/chat/EntryTab";
import { ChatTab } from "@/components/chat/ChatTab";
import { InfoTab } from "@/components/chat/InfoTab";

/**
 * The engagement centre: one floating launcher, three tabs.
 *
 * Order is deliberate. Entry is first because entering the contest is the single
 * conversion this site exists for, and the widget lets someone do it without
 * leaving the page they arrived on. Chat is second for the people who need a
 * question answered before they will commit. Info is third, and it is the tab
 * that quietly fixes the old site's worst habit — every route on it goes
 * somewhere real, where the original had 42 links pointing at "#".
 *
 * All three panels stay mounted so a half-typed entry survives a tab switch.
 */

const TABS = [
  { key: "entry", label: "Enter", title: "Enter the contest" },
  { key: "chat", label: "Chat", title: "Ask a question" },
  { key: "info", label: "Info", title: "Shows, channels and contacts" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SESSION_STORAGE_KEY = "dl_chat_session";

/**
 * Per-visit id, generated in the browser and never derived from anything
 * identifying. sessionStorage rather than localStorage so a conversation is one
 * visit, not a transcript that grows for months.
 */
function getSessionId(): string {
  const fallback = () =>
    `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;

    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : fallback();

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Private mode, or storage blocked. A per-mount id still works, it just does
    // not survive a reload.
    return fallback();
  }
}

export function ChatWidget({ showSlug }: { showSlug?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("entry");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatOpened, setChatOpened] = useState(false);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  // The id is created on first open, not on mount: a visitor who never touches
  // the widget gets no storage write and no Conversation row.
  useEffect(() => {
    if (open && !sessionId) setSessionId(getSessionId());
  }, [open, sessionId]);

  useEffect(() => {
    if (tab === "chat") setChatOpened(true);
  }, [tab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Move focus into the panel when it opens, so the keyboard follows the eye.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Lock the page behind the sheet on phones only. On desktop the panel is a
  // corner card and the page underneath should still scroll.
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {/* Backdrop, phones only. Desktop keeps the page usable behind the card. */}
      {open && (
        <button
          type="button"
          aria-label="Close the help panel"
          onClick={close}
          className="fixed inset-0 z-[60] bg-ink/70 backdrop-blur-sm md:hidden"
        />
      )}

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Dean's List help and entry"
        // Keeps the closed panel out of the tab order and the accessibility tree
        // while its children stay mounted, so a half-typed entry is not lost.
        inert={!open}
        className={cn(
          "fixed z-[61] flex flex-col overflow-hidden border border-ink-line bg-ink-soft shadow-lift",
          "inset-x-0 bottom-0 max-h-[86dvh] rounded-t-2xl",
          "md:inset-x-auto md:bottom-24 md:right-5 md:h-[38rem] md:max-h-[calc(100dvh-9rem)] md:w-[24.5rem] md:rounded-card",
          "transition-[opacity,transform] duration-base ease-crisp",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <header className="shrink-0 border-b border-ink-line bg-ink-raised px-5 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">The Dean&apos;s List</p>
              <p className="mt-1 text-sm text-chalk-muted">
                Enter, ask, or find the team.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="-mr-1 -mt-1 rounded-full p-2 text-chalk-faint transition-colors duration-base ease-crisp hover:text-gold"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div role="tablist" aria-label="Help panel sections" className="mt-4 flex gap-6">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  id={`dl-tab-${t.key}`}
                  aria-selected={active}
                  aria-controls={`dl-panel-${t.key}`}
                  title={t.title}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "relative pb-3 text-xs font-semibold uppercase tracking-widest transition-colors duration-base ease-crisp",
                    active ? "text-gold" : "text-chalk-faint hover:text-chalk",
                  )}
                >
                  {t.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 -bottom-px h-px",
                      active ? "bg-gold-metal" : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            role="tabpanel"
            id="dl-panel-entry"
            aria-labelledby="dl-tab-entry"
            hidden={tab !== "entry"}
            className="h-full overflow-y-auto px-5 py-5"
          >
            <EntryTab showSlug={showSlug} onAskInstead={() => setTab("chat")} />
          </div>

          <div
            role="tabpanel"
            id="dl-panel-chat"
            aria-labelledby="dl-tab-chat"
            hidden={tab !== "chat"}
            className="h-full"
          >
            <ChatTab active={tab === "chat" && open} started={chatOpened} sessionId={sessionId} />
          </div>

          <div
            role="tabpanel"
            id="dl-panel-info"
            aria-labelledby="dl-tab-info"
            hidden={tab !== "info"}
            className="h-full overflow-y-auto px-5 py-5"
          >
            <InfoTab />
          </div>
        </div>
      </div>

      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={open ? "Close the help panel" : "Enter the contest or ask a question"}
        className={cn(
          "btn-primary fixed bottom-5 right-5 z-[62] gap-2 !px-5 !py-3 shadow-lift",
          open && "md:!px-4",
        )}
      >
        {open ? (
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="none">
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="none">
            <path
              d="M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5v7A1.5 1.5 0 0115.5 14H8l-4 3v-3H4.5A1.5 1.5 0 013 12.5v-7z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span className={cn(open && "sr-only md:not-sr-only")}>{open ? "Close" : "Enter / Ask"}</span>
      </button>
    </>
  );
}
