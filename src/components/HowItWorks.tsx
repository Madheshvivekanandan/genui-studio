/**
 * FRONTEND · components/HowItWorks.tsx — the "How it works" page (URL /how-it-works).
 *
 * Replays ONE real chat turn step by step, from the prompt to the screen,
 * using the trace recorded by components/traceStore.ts (or a saved sample).
 */
"use client";

import { SPEC_DATA_PART_TYPE, type Spec } from "@json-render/core";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Preview } from "@/components/Canvas";
import { useTraces } from "@/components/traceStore";
import { buildInstructions, catalog, RULES } from "@/lib/catalog";
import sampleTraces from "@/lib/sample-traces.json";
import type { Trace } from "@/lib/trace";

type Lane = "browser" | "server" | "llm";
const LANES: Record<Lane, { label: string; dot: string; chip: string; border: string }> = {
  browser: { label: "Browser", dot: "bg-blue-500", chip: "bg-blue-100 text-blue-700", border: "border-l-blue-500" },
  server: { label: "Server", dot: "bg-violet-500", chip: "bg-violet-100 text-violet-700", border: "border-l-violet-500" },
  llm: { label: "Gemini (LLM)", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800", border: "border-l-amber-500" },
};

export function HowItWorks() {
  const stored = useTraces();
  const traces = stored.length ? stored : (sampleTraces as unknown as Trace[]);
  const [index, setIndex] = useState(0);
  const t = traces[Math.min(index, traces.length - 1)];

  if (!t) return <p className="p-10">No trace yet: send a prompt in the app first.</p>;

  const s = t.server;
  const call = s?.llmCalls[0];
  const patches = t.parts.filter((p) => (p as { type: string }).type === SPEC_DATA_PART_TYPE);
  const steps = buildSteps(t, patches);

  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl space-y-8 p-6 text-sm">
      {/* ---------- header ---------- */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">How GenUI Studio works</h1>
          <p className="text-gray-500">Every step of one real request, from your prompt to the screen.</p>
        </div>
        <div className="flex items-center gap-2">
          {!stored.length && <span className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">saved sample</span>}
          <select value={index} onChange={(e) => setIndex(Number(e.target.value))} className="max-w-xs rounded-lg border bg-transparent px-2 py-1.5">
            {traces.map((tr, i) => (
              <option key={tr.id} value={i}>
                {tr.server?.editMode ? "✎ edit: " : "＋ new: "}
                {tr.userText.slice(0, 60)}
              </option>
            ))}
          </select>
          <Link href="/" className="text-blue-600 hover:underline">← App</Link>
        </div>
      </header>

      {/* ---------- key numbers ---------- */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="LLM calls" value={String(s?.llmCalls.length ?? "?")} note="one HTTP request to Google" />
        <Stat label="Tool calls" value={String(call?.toolCalls ?? 0)} note="the LLM just writes text" />
        <Stat label="Tokens in → out" value={`${fmt(call?.inputTokens)} → ${fmt(call?.outputTokens)}`} note="mostly the instructions" />
        <Stat label="Total time" value={s ? `${(s.durationMs / 1000).toFixed(1)} s` : "?"} note={s?.model ?? ""} />
      </section>

      {/* ---------- swimlane map ---------- */}
      <section className="overflow-x-auto rounded-xl border p-4">
        <div className="grid min-w-[640px] grid-cols-[2rem_1fr_1fr_1fr] gap-x-3 gap-y-1">
          <span />
          {(Object.keys(LANES) as Lane[]).map((l) => (
            <span key={l} className={`rounded px-2 py-1 text-center text-xs font-semibold ${LANES[l].chip}`}>{LANES[l].label}</span>
          ))}
          {steps.map((st, i) => (
            <Row key={i} n={i + 1} lane={st.lane} title={st.title} />
          ))}
        </div>
      </section>

      {/* ---------- the steps ---------- */}
      <ol className="space-y-4">
        {steps.map((st, i) => (
          <li key={i} id={`step-${i + 1}`} className={`scroll-mt-4 rounded-xl border border-l-4 p-4 ${LANES[st.lane].border}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white dark:bg-white dark:text-gray-900">{i + 1}</span>
              <h2 className="text-base font-semibold">{st.title}</h2>
              <span className={`rounded px-2 py-0.5 text-xs ${LANES[st.lane].chip}`}>{LANES[st.lane].label}</span>
              <code className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{st.where}</code>
            </div>
            <div className="mt-2 space-y-3 text-gray-700 dark:text-gray-300">{st.body}</div>
          </li>
        ))}
      </ol>
    </main>
  );
}

/* ================================================================== */
/* The 13 steps                                                        */
/* ================================================================== */

type Step = { lane: Lane; title: string; where: string; body: ReactNode };

function buildSteps(t: Trace, patches: unknown[]): Step[] {
  const s = t.server;
  const call = s?.llmCalls[0];
  const body = call?.requestBody as GoogleBody | undefined;
  const request = safeJson(t.requestBody) as { messages?: unknown[] } | null;
  const instructions = buildInstructions();
  const v = t.versionBefore;

  return [
    {
      lane: "browser",
      title: "You type the prompt",
      where: "components/ChatScreen.tsx",
      body: <Data label="your text" value={t.userText} open />,
    },
    {
      lane: "browser",
      title: "useChat sends the whole conversation",
      where: "useChat · AI SDK",
      body: (
        <>
          <p>
            Your text becomes a <b>UIMessage</b>. useChat POSTs <b>all {request?.messages?.length ?? "?"} messages</b> to <code>/api/chat</code>: the server
            keeps no memory.
          </p>
          <Data label="POST /api/chat — request body" value={pretty(request ?? t.requestBody)} />
        </>
      ),
    },
    {
      lane: "server",
      title: "The route receives it",
      where: "app/api/chat/route.ts",
      body: <Code>{`export async function POST(req) {\n  const { messages } = await req.json();\n  return streamAgentReply(messages);   // → server/agent.ts\n}`}</Code>,
    },
    {
      lane: "server",
      title: s?.editMode ? `Adds the current page (v${v}) to your prompt` : "Nothing to add: there is no page yet",
      where: "server/agent.ts · lib/spec.ts · buildUserPrompt (json-render)",
      body: s?.editMode ? (
        <>
          <p>
            The page is rebuilt from the earlier answers (lib/spec.ts) and wrapped around your request, so the LLM <b>edits</b> instead of starting over.
          </p>
          <Data label="the user message the LLM receives" value={s.sentPrompt} open />
        </>
      ) : (
        <p>First request: your prompt goes to the LLM unchanged.</p>
      ),
    },
    {
      lane: "server",
      title: "Instructions are generated from the catalog",
      where: "lib/catalog.ts · catalog.prompt() (json-render)",
      body: (
        <>
          <p>
            json-render writes the system prompt from our <b>{catalog.componentNames.length} components</b> (names, props, descriptions) +{" "}
            <b>{RULES.length} rules</b>, and teaches the output format (JSON patch lines). {fmt(instructions.length)} characters.
          </p>
          <Data label="system instructions" value={instructions} />
        </>
      ),
    },
    {
      lane: "server",
      title: "One HTTP call to Google",
      where: "streamText · AI SDK + @ai-sdk/google",
      body: (
        <>
          <p>
            The AI SDK converts everything into <b>Google&apos;s format</b> and sends it. <code>systemInstruction</code> = step 5,{" "}
            <code>contents</code> = the conversation. There is <b>no <code>tools</code> field</b>, so the model cannot call tools.
          </p>
          <Data label={`request body sent to ${call?.provider ?? "the provider"} (${call?.modelId ?? ""})`} value={pretty(shortenBody(body))} open />
        </>
      ),
    },
    {
      lane: "llm",
      title: "The LLM generates the answer",
      where: `${call?.modelId ?? "Gemini"}`,
      body: (
        <>
          <p>
            It reads {fmt(call?.inputTokens)} tokens (instructions + conversation) and predicts the answer token by token ({fmt(call?.outputTokens)}{" "}
            tokens), streaming as it goes. Finish reason: <code>{call?.finishReason}</code>.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Box title="This POC (json-render)">
              1 call. The LLM writes <b>text</b>: a sentence, then JSON patch lines it learned from the instructions.
            </Box>
            <Box title="Tool-calling alternative">
              The LLM returns a <code>functionCall</code> (e.g. renderPage + JSON); the server runs it and sends the result back: 2+ calls.
            </Box>
          </div>
        </>
      ),
    },
    {
      lane: "llm",
      title: "What the LLM returned (raw)",
      where: "Gemini → server",
      body: <Data label={`raw text (${fmt(s?.rawOutput.length)} chars)`} value={s?.rawOutput ?? "(not recorded)"} open />,
    },
    {
      lane: "server",
      title: "The stream is sorted and sent to the browser",
      where: "pipeJsonRender (json-render) · toUIMessageStream (AI SDK)",
      body: (
        <>
          <p>
            While it streams: the sentence → <code>text-delta</code> chunks; each JSON line → one <code>data-spec</code> chunk. Sent as Server-Sent
            Events.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(t.chunkCounts).map(([type, n]) => (
              <span key={type} className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-gray-800">
                {type} × {n}
              </span>
            ))}
          </div>
          <Data label={`the wire (${t.sseTotal} lines, text-delta lines grouped)`} value={(t.wire ?? []).join("\n")} />
        </>
      ),
    },
    {
      lane: "browser",
      title: "useChat rebuilds the message",
      where: "useChat · AI SDK",
      body: (
        <>
          <p>
            The chunks become one assistant message: a <code>text</code> part (shown in the chat) +{" "}
            <b>
              {patches.length} data-spec part{patches.length === 1 ? "" : "s"}
            </b>{" "}
            (the patches).
          </p>
          <Data label="message.parts" value={pretty(t.parts.filter((p) => (p as { type: string }).type !== "step-start"))} />
        </>
      ),
    },
    {
      lane: "browser",
      title: s?.editMode ? `Patches applied on top of v${v} → v${v + 1}` : `Patches applied → v${v + 1}`,
      where: "lib/spec.ts · applySpecPatch (json-render)",
      body: (
        <>
          <p>
            Each patch is applied in order (add / replace / remove). Result: the <b>spec</b>, a flat map of elements pointing to their children by
            key.
          </p>
          {t.specBefore && <Data label={`page before (v${v})`} value={pretty(t.specBefore)} />}
          <Data label={`page after (v${v + 1})`} value={pretty(t.specAfter)} open />
        </>
      ),
    },
    {
      lane: "browser",
      title: "Validation",
      where: "lib/validate.ts",
      body: (
        <>
          <p>3 checks: structure (validateSpec), props against the Zod schemas (catalog.validate), our own rules.</p>
          {t.problems.length === 0 ? (
            <p className="font-medium text-emerald-600">✓ valid: no problems found</p>
          ) : (
            <ul className="list-disc pl-5 text-amber-700">{t.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
        </>
      ),
    },
    {
      lane: "browser",
      title: "Renderer maps JSON to React components",
      where: "<Renderer> (json-render) · components/registry.tsx",
      body: (
        <>
          <p>
            Starts at <code>root</code>; for each element it calls <code>registry[type]</code> with its props, rendering children inside their
            parent.
          </p>
          {t.specAfter && <Mapping spec={t.specAfter} />}
          {t.specAfter && (
            <div className="overflow-hidden rounded-xl border">
              <Preview spec={t.specAfter} streaming={false} />
            </div>
          )}
        </>
      ),
    },
  ];
}

/* ================================================================== */
/* Small building blocks for this page                                 */
/* ================================================================== */

function Row({ n, lane, title }: { n: number; lane: Lane; title: string }) {
  return (
    <>
      <a href={`#step-${n}`} className="py-1 text-right font-mono text-xs text-gray-400">{n}</a>
      {(Object.keys(LANES) as Lane[]).map((l) => (
        <a key={l} href={`#step-${n}`} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-900">
          {l === lane && (
            <>
              <span className={`size-2.5 shrink-0 rounded-full ${LANES[l].dot}`} />
              <span className="truncate">{title}</span>
            </>
          )}
        </a>
      ))}
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      <p className="truncate text-xs text-gray-400">{note}</p>
    </div>
  );
}

function Data({ label, value, open }: { label: string; value: string; open?: boolean }) {
  return (
    <details open={open} className="rounded-lg border bg-gray-50 dark:bg-gray-900">
      <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-gray-500">{label}</summary>
      <pre className="max-h-80 overflow-auto border-t px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{value}</pre>
    </details>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{children}</pre>;
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-1 font-semibold">{title}</p>
      <p>{children}</p>
    </div>
  );
}

/** Element tree: key → type → registry component, indented by depth. */
function Mapping({ spec }: { spec: Spec }) {
  const rows: { depth: number; key: string; type: string; props: string }[] = [];
  const visit = (key: string, depth: number) => {
    const el = spec.elements[key];
    if (!el) return;
    const props = Object.entries(el.props ?? {})
      .filter(([, v]) => v !== null && typeof v !== "object")
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(", ");
    rows.push({ depth, key, type: el.type, props });
    el.children?.forEach((c) => visit(c, depth + 1));
  };
  visit(spec.root, 0);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-500 dark:bg-gray-900">
          <tr>
            <th className="px-3 py-1.5">element key (from the LLM)</th>
            <th className="px-3 py-1.5">type</th>
            <th className="px-3 py-1.5">rendered by</th>
            <th className="px-3 py-1.5">props</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t">
              <td className="px-3 py-1 font-mono" style={{ paddingLeft: `${0.75 + r.depth * 1.25}rem` }}>
                {r.depth > 0 && "└ "}
                {r.key}
              </td>
              <td className="px-3 py-1 font-semibold">{r.type}</td>
              <td className="px-3 py-1 font-mono text-gray-500">registry.{r.type}</td>
              <td className="max-w-sm truncate px-3 py-1 text-gray-500">{r.props}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- helpers ---------- */

type GoogleBody = { systemInstruction?: { parts?: { text?: string }[] } } & Record<string, unknown>;

/** The server stores the system instruction shortened; point to step 5 for the full text. */
function shortenBody(body: GoogleBody | undefined) {
  if (!body) return "(not recorded)";
  const text = body.systemInstruction?.parts?.[0]?.text ?? "";
  const chars = /^\[(\d+) characters/.exec(text)?.[1];
  const label = chars ? `[${fmt(Number(chars))} characters: full text in step 5]` : `${text.slice(0, 160)}… [full text in step 5]`;
  return { ...body, systemInstruction: { parts: [{ text: label }] } };
}

const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));
const fmt = (n: number | undefined) => (n === undefined ? "?" : n.toLocaleString("en-US"));
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
