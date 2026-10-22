/**
 * FRONTEND · components/traceStore.ts — records each chat turn for the How-it-works page.
 *
 *   captureFetch : passed to useChat's transport; copies the request body and
 *                  the raw response stream as they go over the network
 *   saveTrace    : after a turn finishes, combines that with the message,
 *                  the rebuilt page and validation, and stores it in localStorage
 *   useTraces    : read the stored traces (works across browser tabs)
 */
import { useSyncExternalStore } from "react";
import { currentSpec } from "@/lib/spec";
import type { GenUIMessage, Trace } from "@/lib/trace";
import { findProblems } from "@/lib/validate";

const KEY = "genui:traces";
const MAX_TRACES = 10;
const MAX_WIRE_LINES = 200;

let lastWire: Promise<{ requestBody: string; sse: string }> | null = null;

/** A drop-in fetch that lets us see the exact bytes useChat sends and receives. */
export const captureFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (!res.body) return res;
  const [forUseChat, forTrace] = res.body.tee(); // split the stream in two identical copies
  lastWire = new Response(forTrace).text().then((sse) => ({ requestBody: String(init?.body ?? ""), sse }));
  return new Response(forUseChat, { status: res.status, statusText: res.statusText, headers: res.headers });
};

export async function saveTrace(message: GenUIMessage, messages: GenUIMessage[]) {
  const wire = (await lastWire) ?? { requestBody: "", sse: "" };
  const before = messages.slice(0, -1);
  const lastUser = [...before].reverse().find((m) => m.role === "user");
  const specAfter = currentSpec(messages);

  const lines = wire.sse.split("\n").filter((l) => l.startsWith("data: "));
  const chunkCounts: Record<string, number> = {};
  for (const l of lines) {
    const type = l === "data: [DONE]" ? "[DONE]" : (safeJson(l.slice(6)) as { type?: string })?.type ?? "?";
    chunkCounts[type] = (chunkCounts[type] ?? 0) + 1;
  }

  const trace: Trace = {
    id: message.id,
    at: new Date().toISOString(),
    userText: lastUser?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "",
    requestBody: wire.requestBody,
    wire: groupDeltas(lines).slice(0, MAX_WIRE_LINES),
    sseTotal: lines.length,
    chunkCounts,
    parts: message.parts,
    versionBefore: before.filter((m) => m.role === "assistant" && m.parts.some((p) => p.type === "data-spec")).length,
    specBefore: currentSpec(before),
    specAfter,
    problems: specAfter ? findProblems(specAfter) : [],
    server: message.metadata?.trace,
  };

  try {
    const traces = [trace, ...readTraces()].slice(0, MAX_TRACES);
    localStorage.setItem(KEY, JSON.stringify(traces));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY })); // notify this tab too
  } catch {
    // storage full or blocked (private mode): the page falls back to the sample
  }
}

/* ---- reading (with a cached snapshot, as useSyncExternalStore requires) ---- */
let cachedRaw: string | null = null;
let cachedTraces: Trace[] = [];

function readTraces(): Trace[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedTraces = raw ? ((safeJson(raw) as Trace[]) ?? []) : [];
  }
  return cachedTraces;
}

const EMPTY: Trace[] = [];
export function useTraces(): Trace[] {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    readTraces,
    () => EMPTY, // on the server there is no localStorage
  );
}

/** Collapses runs of text-delta lines (often 1 line per few characters) so data-spec lines stand out. */
function groupDeltas(lines: string[]): string[] {
  const out: string[] = [];
  let run = 0;
  let text = "";
  const flush = () => {
    if (run) out.push(`data: {"type":"text-delta", …}   ← ${run} chunks: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"`);
    run = 0;
    text = "";
  };
  for (const l of lines) {
    const j = safeJson(l.slice(6)) as { type?: string; delta?: string } | null;
    if (j?.type === "text-delta") {
      run++;
      text += j.delta ?? "";
      continue;
    }
    flush();
    out.push(l.length > 300 ? `${l.slice(0, 300)}…` : l);
  }
  flush();
  return out;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
