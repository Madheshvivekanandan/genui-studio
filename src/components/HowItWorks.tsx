/**
 * FRONTEND · components/HowItWorks.tsx — the "How it works" page (URL /how-it-works).
 *
 * Replays ONE real chat turn step by step, from the prompt to the screen,
 * using the trace recorded by components/traceStore.ts (or a saved sample).
 * Layout: header (prompt, flow strip, numbers) · sticky timeline · step cards.
 */
"use client";

import { SPEC_DATA_PART_TYPE, type Spec } from "@json-render/core";
import Link from "next/link";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Preview } from "@/components/Canvas";
import { useTraces } from "@/components/traceStore";
import { buildInstructions, catalog, RULES } from "@/lib/catalog";
import sampleTraces from "@/lib/sample-traces.json";
import type { Trace } from "@/lib/trace";

type Lane = "browser" | "server" | "llm";
const LANES: Record<Lane, { label: string; text: string; bg: string; soft: string; ring: string }> = {
  browser: { label: "Browser", text: "text-sky-300", bg: "bg-sky-500", soft: "bg-sky-500/15 text-sky-300", ring: "ring-sky-500/40" },
  server: { label: "Server", text: "text-violet-300", bg: "bg-violet-500", soft: "bg-violet-500/15 text-violet-300", ring: "ring-violet-500/40" },
  llm: { label: "Gemini", text: "text-amber-300", bg: "bg-amber-500", soft: "bg-amber-500/15 text-amber-300", ring: "ring-amber-500/40" },
};

type Step = { lane: Lane; title: string; where: string; summary: ReactNode; data?: ReactNode };

export function HowItWorks() {
  const stored = useTraces();
  const traces = stored.length ? stored : (sampleTraces as unknown as Trace[]);
  const [index, setIndex] = useState(0);
  const t = traces[Math.min(index, traces.length - 1)];
  const active = useActiveStep(13);

  if (!t) return <p className="p-10">No trace yet: send a prompt in the app first.</p>;

  const s = t.server;
  const call = s?.llmCalls[0];
  const patches = t.parts.filter((p) => (p as { type: string }).type === SPEC_DATA_PART_TYPE);
  const steps = buildSteps(t, patches.length);

  return (
    <div className="min-h-dvh w-full bg-slate-950 font-sans text-slate-300">
      {/* ================= HEADER ================= */}
      <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-950">
        <div className="pointer-events-none absolute -top-32 right-0 size-[32rem] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative space-y-8 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 font-bold text-white">G</span>
              <div>
                <p className="text-sm font-semibold text-white">GenUI Studio</p>
                <p className="text-xs text-slate-400">How it works · one real request, end to end</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {!stored.length && <span className="rounded-full bg-white/10 px-3 py-1 text-xs">saved sample</span>}
              <select
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
                className="max-w-xs rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-slate-200"
              >
                {traces.map((tr, i) => (
                  <option key={tr.id} value={i}>
                    {tr.server?.editMode ? "Edit · " : "New · "}
                    {tr.userText.slice(0, 60)}
                  </option>
                ))}
              </select>
              <Link href="/" className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-900 hover:bg-slate-200">
                ← Back to app
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-4xl space-y-3">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${s?.editMode ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                {s?.editMode ? `Edit of page v${t.versionBefore}` : "New page"}
              </span>
              <p className="text-3xl leading-tight font-semibold text-white lg:text-4xl">“{t.userText}”</p>
            </div>
            <FlowStrip />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Stat label="LLM calls" value={String(s?.llmCalls.length ?? "?")} note="HTTP requests to Google" accent="from-amber-500/20" />
            <Stat label="Tokens in" value={fmt(call?.inputTokens)} note="instructions + chat" accent="from-violet-500/20" />
            <Stat label="Tokens out" value={fmt(call?.outputTokens)} note="sentence + patches" accent="from-violet-500/20" />
            <Stat label="Patches" value={String(patches.length)} note="JSON lines applied" accent="from-sky-500/20" />
            <Stat label="Total time" value={s ? `${(s.durationMs / 1000).toFixed(1)}s` : "?"} note={s?.model ?? ""} accent="from-emerald-500/20" />
          </div>
        </div>
      </header>

      {/* ================= TIMELINE + STEPS ================= */}
      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-10">
        <aside className="hidden lg:block">
          <nav className="sticky top-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">The 13 steps</p>
            <ol className="relative space-y-1">
              <span className="absolute top-3 bottom-3 left-[0.95rem] w-px bg-white/10" />
              {steps.map((st, i) => {
                const n = i + 1;
                const on = n === active;
                return (
                  <li key={n}>
                    <a
                      href={`#step-${n}`}
                      className={`relative flex items-center gap-3 rounded-lg px-1.5 py-1.5 text-sm transition ${on ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
                    >
                      <span className={`z-10 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-slate-950 ${LANES[st.lane].bg} ${on ? `ring-4 ${LANES[st.lane].ring}` : ""}`}>
                        {n}
                      </span>
                      <span className="truncate">{st.title}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3 text-xs">
              {(Object.keys(LANES) as Lane[]).map((l) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${LANES[l].bg}`} /> {LANES[l].label}
                </span>
              ))}
            </div>
          </nav>
        </aside>

        <main className="min-w-0 space-y-5">
          {steps.map((st, i) => (
            <StepCard key={i} n={i + 1} step={st} />
          ))}
        </main>
      </div>
    </div>
  );
}

/* ================================================================== */
/* The 13 steps                                                        */
/* ================================================================== */

function buildSteps(t: Trace, patchCount: number): Step[] {
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
      summary: <p>You type in the chat box and press Send.</p>,
      data: <Data label="your text" value={t.userText} />,
    },
    {
      lane: "browser",
      title: "useChat sends the conversation",
      where: "useChat · AI SDK",
      summary: (
        <p>
          Your text becomes a <b>UIMessage</b>. useChat POSTs <b>all {request?.messages?.length ?? "?"} messages</b> to <Mono>/api/chat</Mono>: the
          server keeps no memory between requests.
        </p>
      ),
      data: <Data label="POST /api/chat · request body" value={pretty(request ?? t.requestBody)} />,
    },
    {
      lane: "server",
      title: "The route receives it",
      where: "app/api/chat/route.ts",
      summary: <p>Next.js maps the URL to this file. It only reads the JSON and hands the messages to the agent.</p>,
      data: <Data label="route.ts" value={`export async function POST(req) {\n  const { messages } = await req.json();\n  return streamAgentReply(messages);   // → server/agent.ts\n}`} />,
    },
    {
      lane: "server",
      title: s?.editMode ? `Current page (v${v}) is attached` : "Nothing to attach yet",
      where: "server/agent.ts · lib/spec.ts · buildUserPrompt",
      summary: s?.editMode ? (
        <p>
          The page is rebuilt from the earlier answers and wrapped around your request, so the LLM <b>edits</b> it instead of starting over.
        </p>
      ) : (
        <p>First request: there is no page yet, so your prompt goes to the LLM unchanged.</p>
      ),
      data: <Data label="the user message the LLM receives" value={s?.sentPrompt ?? t.userText} />,
    },
    {
      lane: "server",
      title: "Instructions from the catalog",
      where: "lib/catalog.ts · catalog.prompt()",
      summary: (
        <p>
          json-render writes the system prompt from our <b>{catalog.componentNames.length} components</b> + <b>{RULES.length} rules</b>, and teaches the
          output format (JSON patch lines). {fmt(instructions.length)} characters.
        </p>
      ),
      data: <Data label="system instructions" value={instructions} />,
    },
    {
      lane: "server",
      title: "One HTTP call to Google",
      where: "streamText · @ai-sdk/google",
      summary: (
        <p>
          The AI SDK translates everything into Google&apos;s format: <Mono>systemInstruction</Mono> = step 5, <Mono>contents</Mono> = the
          conversation. There is <b>no <Mono>tools</Mono> field</b>, so the model cannot call tools.
        </p>
      ),
      data: <Data label={`request body → ${call?.provider ?? "provider"} · ${call?.modelId ?? ""}`} value={pretty(shortenBody(body))} />,
    },
    {
      lane: "llm",
      title: "The LLM generates the answer",
      where: call?.modelId ?? "Gemini",
      summary: (
        <p>
          It reads <b>{fmt(call?.inputTokens)} tokens</b> and predicts the answer token by token (<b>{fmt(call?.outputTokens)} tokens</b>), streaming
          as it goes. Finish reason: <Mono>{call?.finishReason ?? "?"}</Mono>.
        </p>
      ),
      data: (
        <div className="grid gap-3 md:grid-cols-2">
          <Compare title="This POC · json-render" tone="emerald" active>
            <b>1 call.</b> The LLM writes <b>text</b>: a sentence, then JSON patch lines it learned from the instructions.
          </Compare>
          <Compare title="Alternative · tool calling" tone="slate">
            The LLM returns a <Mono>functionCall</Mono> with the UI JSON; the server runs it and sends the result back: <b>2+ calls.</b>
          </Compare>
        </div>
      ),
    },
    {
      lane: "llm",
      title: "What the LLM returned (raw)",
      where: "Gemini → server",
      summary: <p>Exactly what came back, before any processing: one sentence, then the patch lines in a <Mono>```spec</Mono> block.</p>,
      data: <Data label={`raw text · ${fmt(s?.rawOutput.length)} chars`} value={s?.rawOutput ?? "(not recorded)"} />,
    },
    {
      lane: "server",
      title: "Stream sorted for the browser",
      where: "pipeJsonRender · toUIMessageStream",
      summary: (
        <>
          <p>
            While it streams, the sentence becomes <Mono>text-delta</Mono> chunks and each JSON line one <Mono>data-spec</Mono> chunk, sent as
            Server-Sent Events.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(t.chunkCounts).map(([type, n]) => (
              <span key={type} className={`rounded-md px-2 py-0.5 font-mono text-xs ${type === "data-spec" ? "bg-sky-500/20 text-sky-300" : "bg-white/5 text-slate-400"}`}>
                {type} × {n}
              </span>
            ))}
          </div>
        </>
      ),
      data: <Data label={`the wire · ${t.sseTotal} lines (text chunks grouped)`} value={(t.wire ?? []).join("\n")} />,
    },
    {
      lane: "browser",
      title: "useChat rebuilds the message",
      where: "useChat · AI SDK",
      summary: (
        <p>
          The chunks become one assistant message: a <Mono>text</Mono> part for the chat + <b>{patchCount} data-spec part{patchCount === 1 ? "" : "s"}</b>{" "}
          (the patches).
        </p>
      ),
      data: <Data label="message.parts" value={pretty(t.parts.filter((p) => (p as { type: string }).type !== "step-start"))} />,
    },
    {
      lane: "browser",
      title: s?.editMode ? `Patches applied: v${v} → v${v + 1}` : `Patches applied → v${v + 1}`,
      where: "lib/spec.ts · applySpecPatch",
      summary: <p>Each patch (add / replace / remove) is applied in order. The result is the page JSON: a flat map of elements that point to their children.</p>,
      data: t.specBefore ? (
        <div className="grid gap-3 2xl:grid-cols-2">
          <Data label={`before · v${v}`} value={pretty(t.specBefore)} />
          <Data label={`after · v${v + 1}`} value={pretty(t.specAfter)} />
        </div>
      ) : (
        <Data label={`page JSON · v${v + 1}`} value={pretty(t.specAfter)} />
      ),
    },
    {
      lane: "browser",
      title: "Validation",
      where: "lib/validate.ts",
      summary: <p>Three checks: structure (validateSpec), props against the Zod schemas (catalog.validate), and our own rules.</p>,
      data:
        t.problems.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300">
            <span className="text-xl">✓</span> Valid: no problems found
          </div>
        ) : (
          <ul className="list-disc space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 pr-4 pl-8 text-amber-300">
            {t.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        ),
    },
    {
      lane: "browser",
      title: "JSON mapped to React components",
      where: "<Renderer> · components/registry.tsx",
      summary: (
        <p>
          Starting at <Mono>root</Mono>, each element&apos;s <Mono>type</Mono> is looked up in the registry and rendered with its props, children inside
          their parent.
        </p>
      ),
      data: t.specAfter && (
        <div className="grid gap-4 2xl:grid-cols-2">
          <Mapping spec={t.specAfter} />
          <div className="overflow-hidden rounded-xl border border-white/10">
            <p className="border-b border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-500">rendered result</p>
            <Preview spec={t.specAfter} streaming={false} />
          </div>
        </div>
      ),
    },
  ];
}

/* ================================================================== */
/* Building blocks                                                     */
/* ================================================================== */

function StepCard({ n, step }: { n: number; step: Step }) {
  const lane = LANES[step.lane];
  return (
    <section id={`step-${n}`} className="scroll-mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-white/[0.02] px-5 py-3">
        <span className={`flex size-7 items-center justify-center rounded-lg text-sm font-bold text-slate-950 ${lane.bg}`}>{n}</span>
        <h2 className="text-lg font-semibold text-white">{step.title}</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${lane.soft}`}>{lane.label}</span>
        <code className="ml-auto rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-400">{step.where}</code>
      </div>
      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3 text-[15px] leading-relaxed">{step.summary}</div>
        <div className="min-w-0">{step.data}</div>
      </div>
    </section>
  );
}

function FlowStrip() {
  const segments: { lane: Lane; steps: string }[] = [
    { lane: "browser", steps: "1–2" },
    { lane: "server", steps: "3–6" },
    { lane: "llm", steps: "7–8" },
    { lane: "server", steps: "9" },
    { lane: "browser", steps: "10–13" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-slate-600">→</span>}
          <a href={`#step-${seg.steps.split("–")[0]}`} className={`rounded-xl px-3 py-2 text-center ring-1 ${LANES[seg.lane].soft} ${LANES[seg.lane].ring}`}>
            <span className="block text-sm font-semibold">{LANES[seg.lane].label}</span>
            <span className="block text-[11px] opacity-70">steps {seg.steps}</span>
          </a>
        </Fragment>
      ))}
    </div>
  );
}

function Stat({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accent} to-transparent p-4`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      <p className="truncate text-xs text-slate-500">{note}</p>
    </div>
  );
}

/** A dark code panel with copy button and light JSON highlighting. */
function Data({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-3 py-1.5 text-xs">
        <span className="text-slate-400">{label}</span>
        <button
          onClick={() => navigator.clipboard?.writeText(value).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1200)))}
          className="rounded px-2 py-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-200"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className="max-h-[26rem] overflow-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-300 [overflow-wrap:anywhere]">
        <Highlight text={value} />
      </pre>
    </div>
  );
}

/** Colours JSON keys, strings, numbers and literals (no HTML injection: plain React spans). */
function Highlight({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const cls = m[1] ? (m[2] ? "text-sky-300" : "text-emerald-300") : m[3] ? "text-violet-300" : "text-amber-300";
    out.push(<span key={i} className={cls}>{m[1] ?? m[0]}</span>);
    if (m[2]) out.push(m[2]);
    last = i + m[0].length;
    if (out.length > 6000) break; // keep huge texts fast
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

function Compare({ title, tone, active, children }: { title: string; tone: "emerald" | "slate"; active?: boolean; children: ReactNode }) {
  const style = tone === "emerald" ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]";
  return (
    <div className={`rounded-xl border p-4 ${style}`}>
      <p className="mb-1.5 flex items-center gap-2 font-semibold text-white">
        {title} {active && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] text-slate-950">USED</span>}
      </p>
      <p className="text-sm text-slate-300">{children}</p>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-100">{children}</code>;
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
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[36rem] text-left text-xs">
        <thead className="bg-slate-900 text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium whitespace-nowrap">element (from the LLM)</th>
            <th className="px-3 py-2 font-medium">type</th>
            <th className="px-3 py-2 font-medium">rendered by</th>
            <th className="px-3 py-2 font-medium">props</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-white/5 hover:bg-white/[0.03]">
              <td className="px-3 py-1.5 font-mono whitespace-nowrap text-slate-300" style={{ paddingLeft: `${0.75 + r.depth * 1.25}rem` }}>
                {r.depth > 0 && <span className="text-slate-600">└ </span>}
                {r.key}
              </td>
              <td className="px-3 py-1.5 font-semibold text-sky-300">{r.type}</td>
              <td className="px-3 py-1.5 font-mono text-violet-300">registry.{r.type}</td>
              <td className="max-w-xs truncate px-3 py-1.5 text-slate-500">{r.props}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Which step card is currently on screen (drives the timeline highlight). */
function useActiveStep(count: number) {
  const [active, setActive] = useState(1);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(Number(visible[0].target.id.replace("step-", "")));
      },
      { rootMargin: "-10% 0px -60% 0px" },
    );
    for (let n = 1; n <= count; n++) {
      const el = document.getElementById(`step-${n}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [count]);
  return active;
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
