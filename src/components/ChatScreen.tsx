/**
 * FRONTEND · components/ChatScreen.tsx — the whole app screen. Runs in the BROWSER.
 *
 * Left: the chat with the agent.  Right: <Canvas>, the page being built.
 * The page itself is never stored separately — it is rebuilt from the chat
 * messages (lib/spec.ts), so every answer becomes a new version.
 */
"use client"; // = "this file and everything it imports runs in the browser"

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@/components/Canvas";
import { captureFetch, saveTrace } from "@/components/traceStore";
import { specVersions } from "@/lib/spec";
import type { GenUIMessage } from "@/lib/trace";

// Same as useChat's default (POST /api/chat), plus a fetch that records
// every request/response for the How-it-works page.
const transport = new DefaultChatTransport<GenUIMessage>({
  api: "/api/chat",
  fetch: captureFetch,
  // Don't send the traces (message metadata) back: the server doesn't need them.
  prepareSendMessagesRequest: ({ id, messages, trigger, messageId, body }) => ({
    body: { ...body, id, trigger, messageId, messages: messages.map((m) => ({ ...m, metadata: undefined })) },
  }),
});

const SUGGESTIONS = [
  { label: "Dashboard", dot: "bg-sky-500", text: "Sales dashboard: 4 KPI metrics in a row, a bar chart of monthly revenue and a table of the top 5 customers" },
  { label: "Landing page", dot: "bg-violet-500", text: "Landing page for a project-management app: a hero, 3 feature cards in a grid and a call to action" },
  { label: "Form", dot: "bg-emerald-500", text: "Sign-up form card with name, email and password fields, a team-size dropdown and a submit button" },
  { label: "Status card", dot: "bg-rose-500", text: "Server health card with 3 progress bars and a warning alert, dark mode with a rose accent" },
];
const EDITS = ["Make it dark with a green accent", "Replace the bar chart with a line chart", "Add a 5th metric: NPS 62"];

export function ChatScreen() {
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<number | null>(null); // null = follow the latest version
  const { messages, sendMessage, setMessages, status, error, stop, regenerate } = useChat<GenUIMessage>({
    transport,
    onFinish: ({ message, messages, isError }) => {
      if (!isError) saveTrace(message, messages);
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const versions = useMemo(() => specVersions(messages), [messages]);
  const selectedIndex = picked ?? versions.length - 1;

  // Keep the newest message in view while the answer streams in.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setPicked(null); // jump back to the newest version
    sendMessage({ text });
    setInput("");
  };

  const lastMessage = messages.at(-1);
  const waiting = status === "submitted" || (status === "streaming" && lastMessage?.role === "assistant" && !textOf(lastMessage));

  return (
    <div className="flex h-dvh font-sans">
      {/* ---------- LEFT: chat ---------- */}
      <aside className="flex w-[420px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <Logo className="size-9 rounded-xl text-sm" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-slate-900 dark:text-white">GenUI Studio</h1>
            <p className="truncate text-xs text-slate-500">Vercel AI SDK + json-render</p>
          </div>
          <a
            href="/how-it-works"
            target="_blank"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10"
          >
            How it works ↗
          </a>
          <button
            onClick={() => (setMessages([]), setPicked(null))}
            disabled={busy || messages.length === 0}
            title="Start a new page"
            aria-label="Start a new page"
            className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <PlusIcon />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 text-sm">
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center gap-5">
              <div className="text-center">
                <Logo className="mx-auto mb-3 size-12 rounded-2xl text-lg" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">What should we build?</h2>
                <p className="mt-1 text-slate-500">Describe a page and the agent builds it from the component catalog.</p>
              </div>
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => send(s.text)}
                    className="group block w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-white/10 dark:hover:border-sky-500/40 dark:hover:bg-sky-500/5"
                  >
                    <span className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                      <span className={`size-2 rounded-full ${s.dot}`} />
                      {s.label}
                      <span className="ml-auto text-slate-400 opacity-0 transition group-hover:opacity-100">→</span>
                    </span>
                    <span className="line-clamp-2 text-slate-500 dark:text-slate-400">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m) => {
                const text = textOf(m);
                const versionIndex = versions.findIndex((v) => v.messageId === m.id);
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-sky-600 px-3.5 py-2.5 whitespace-pre-wrap text-white">{text}</p>
                    </div>
                  );
                }
                if (!text && versionIndex < 0) return null; // still waiting: the typing indicator covers it
                const trace = m.metadata?.trace;
                return (
                  <div key={m.id} className="flex gap-2.5">
                    <Logo className="mt-0.5 size-7 shrink-0 rounded-lg text-[11px]" />
                    <div className="min-w-0 flex-1 space-y-2">
                      {text && <p className="leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200">{text}</p>}
                      {versionIndex >= 0 && (
                        <VersionCard
                          index={versionIndex}
                          selected={versionIndex === selectedIndex}
                          building={busy && m.id === lastMessage?.id}
                          onClick={() => setPicked(versionIndex)}
                        />
                      )}
                      {trace && (
                        <p className="text-[11px] text-slate-400">
                          {trace.model} · {(trace.durationMs / 1000).toFixed(1)}s{trace.editMode ? " · edit" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {waiting && (
                <div className="flex items-center gap-2.5">
                  <Logo className="size-7 shrink-0 rounded-lg text-[11px]" />
                  <span className="flex gap-1 rounded-2xl bg-slate-100 px-3 py-3 dark:bg-white/5">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} style={{ animationDelay: `${delay}ms` }} className="size-1.5 animate-bounce rounded-full bg-slate-400" />
                    ))}
                  </span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <p className="font-medium">Something went wrong</p>
                  <p className="mt-0.5 text-xs break-words opacity-80">{error.message}</p>
                  <button onClick={() => regenerate()} className="mt-2 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700">
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-3 dark:border-white/10">
          {versions.length > 0 && !busy && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pr-8 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none]">
              {EDITS.map((e) => (
                <button
                  key={e}
                  onClick={() => send(e)}
                  className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-sky-300 hover:bg-sky-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-sky-500/10"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <Composer
            value={input}
            onChange={setInput}
            onSend={() => send(input)}
            onStop={stop}
            busy={busy}
            placeholder={versions.length ? "Ask for a change…" : "Describe a page…"}
          />
          <p className="mt-1.5 text-center text-[11px] text-slate-400">Enter to send · Shift + Enter for a new line</p>
        </div>
      </aside>

      {/* ---------- RIGHT: the page being built ---------- */}
      <Canvas versions={versions} selectedIndex={selectedIndex} onSelect={setPicked} streaming={busy && picked === null} />
    </div>
  );
}

function textOf(m: GenUIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
}

/** The message box: grows with its text, Enter sends, and the button turns into Stop while the agent answers. */
function Composer({ value, onChange, onSend, onStop, busy, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e) => (e.preventDefault(), onSend())}
      className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-1.5 pl-3.5 transition focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-500/15 dark:border-white/15 dark:bg-slate-900"
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
        className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
      />
      {busy ? (
        <button type="button" onClick={onStop} title="Stop" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900">
          <span className="size-2.5 rounded-[2px] bg-current" />
        </button>
      ) : (
        <button disabled={!value.trim()} title="Send" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10">
          <ArrowUpIcon />
        </button>
      )}
    </form>
  );
}

/** "This answer produced version N" — click to show it on the canvas. */
function VersionCard({ index, selected, building, onClick }: { index: number; selected: boolean; building: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
        selected
          ? "border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/10"
          : "border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
      }`}
    >
      <span className="rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">v{index + 1}</span>
      <span className="flex-1 text-xs text-slate-600 dark:text-slate-300">
        {building ? "Building page…" : index === 0 ? "Page created" : "Page updated"}
      </span>
      <span className={`text-xs font-medium ${selected ? "text-sky-600 dark:text-sky-400" : "text-slate-400"}`}>{selected ? "Viewing" : "View →"}</span>
    </button>
  );
}

function Logo({ className }: { className: string }) {
  return (
    <span className={`flex items-center justify-center bg-gradient-to-br from-sky-500 to-violet-600 font-bold text-white ${className}`}>G</span>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
    </svg>
  );
}
