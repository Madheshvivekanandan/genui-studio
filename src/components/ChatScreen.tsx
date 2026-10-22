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
import { useMemo, useState } from "react";
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
  "Sales dashboard: 4 KPI metrics in a row, a bar chart of monthly revenue and a table of the top 5 customers",
  "Landing page for a project-management app: a hero, 3 feature cards in a grid and a call to action",
  "Sign-up form card with name, email and password fields, a team-size dropdown and a submit button",
  "Server health card with 3 progress bars and a warning alert, dark mode with a rose accent",
];
const EDITS = ["Make it dark with a green accent", "Replace the bar chart with a line chart", "Add a 5th metric: NPS 62"];

export function ChatScreen() {
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<number | null>(null); // null = follow the latest version
  const { messages, sendMessage, setMessages, status, error } = useChat<GenUIMessage>({
    transport,
    onFinish: ({ message, messages, isError }) => {
      if (!isError) saveTrace(message, messages);
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const versions = useMemo(() => specVersions(messages), [messages]);
  const selectedIndex = picked ?? versions.length - 1;

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setPicked(null); // jump back to the newest version
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="flex h-dvh">
      {/* ---------- LEFT: chat ---------- */}
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-gray-200 dark:border-gray-800">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div>
            <h1 className="font-semibold">GenUI Studio</h1>
            <p className="text-xs text-gray-500">Vercel AI SDK + json-render</p>
          </div>
          <div className="flex gap-3 text-xs">
            <a href="/how-it-works" target="_blank" className="font-medium text-blue-600 hover:underline">
              How it works ↗
            </a>
            <button onClick={() => (setMessages([]), setPicked(null))} className="text-gray-500 hover:underline">
              New page
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-gray-500">Describe a page. Try one:</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
            const versionIndex = versions.findIndex((v) => v.messageId === m.id);
            return m.role === "user" ? (
              <p key={m.id} className="ml-8 rounded-lg bg-blue-600 p-3 text-white">{text}</p>
            ) : (
              <div key={m.id} className="mr-8 space-y-2">
                {text && <p>{text}</p>}
                {versionIndex >= 0 && (
                  <button onClick={() => setPicked(versionIndex)} className="rounded-md border border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-500 dark:border-gray-700">
                    → view v{versionIndex + 1}
                  </button>
                )}
              </div>
            );
          })}

          {status === "submitted" && <p className="animate-pulse text-gray-400">Agent is thinking…</p>}
          {error && <p className="text-red-600">Error: {error.message}</p>}

          {versions.length > 0 && !busy && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {EDITS.map((e) => (
                <button key={e} onClick={() => send(e)} className="rounded-full border border-gray-300 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <form className="flex gap-2 border-t border-gray-200 p-3 dark:border-gray-800" onSubmit={(e) => (e.preventDefault(), send(input))}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={versions.length ? "Ask for a change…" : "Describe a page…"}
            className="flex-1 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
          />
          <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">
            Send
          </button>
        </form>
      </aside>

      {/* ---------- RIGHT: the page being built ---------- */}
      <Canvas versions={versions} selectedIndex={selectedIndex} onSelect={setPicked} streaming={busy && picked === null} />
    </div>
  );
}
