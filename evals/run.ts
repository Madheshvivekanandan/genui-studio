/**
 * evals/run.ts — the instruction-following test suite (POC goal 3).
 *
 * Talks to the RUNNING app exactly like the browser does (POST /api/chat),
 * rebuilds each page from the stream, then runs the checks in cases.ts.
 * Every page is also validated (structure + props + our rules).
 *
 *   1. npm run dev          (in one terminal)
 *   2. npm run eval         (in another)
 *
 * Results are printed and saved to evals/results/<model>-<time>.json.
 * To compare models: change GEMINI_MODEL in .env.local, restart dev, run again.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { UIMessage } from "ai";
import { currentSpec } from "@/lib/spec";
import { findProblems } from "@/lib/validate";
import { CASES } from "./cases";
import { inspect } from "./inspect";

const URL = process.env.EVAL_URL ?? "http://localhost:3000/api/chat";
const PAUSE_MS = 4000; // free tiers limit requests per minute
// Run only some cases:  EVAL_ONLY="Order,Edit: theme only" npm run eval
const ONLY = process.env.EVAL_ONLY?.split(",").map((s) => s.trim());

// Provider problems (overload, quota) are NOT agent mistakes: such cases are
// reported as "not run" and left out of the score.
const isOverload = (msg: string) => /high demand|overloaded|503/i.test(msg);
const isQuota = (msg: string) => /quota|rate limit|429/i.test(msg);

/** ask() with retries for temporary overloads (waits 20s, then 40s). */
async function askWithRetry(history: UIMessage[], text: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ask(history, text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!isOverload(msg) || attempt >= 2) throw e;
      console.log(`   … model overloaded, retrying in ${20 * (attempt + 1)}s`);
      await new Promise((r) => setTimeout(r, 20000 * (attempt + 1)));
    }
  }
}

/** One chat turn over HTTP; returns the assistant message rebuilt from the stream. */
async function ask(history: UIMessage[], text: string) {
  const user: UIMessage = { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] };
  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "eval", trigger: "submit-message", messages: [...history, user] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // The response is Server-Sent Events: lines like  data: {"type":"text-delta",...}
  let reply = "";
  const parts: UIMessage["parts"] = [];
  for (const line of (await res.text()).split("\n")) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    const chunk = JSON.parse(line.slice(6));
    if (chunk.type === "text-delta") reply += chunk.delta;
    if (chunk.type === "data-spec") parts.push({ type: "data-spec", data: chunk.data });
    if (chunk.type === "error") throw new Error(chunk.errorText);
  }
  const assistant: UIMessage = { id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text: reply }, ...parts] };
  return { messages: [...history, user, assistant], model: res.headers.get("x-genui-model") ?? "unknown" };
}

async function main() {
  const results = [];
  let model = "unknown";
  let quotaHit = false;

  for (const c of CASES.filter((c) => !ONLY || ONLY.includes(c.name))) {
    if (quotaHit) {
      results.push({ goal: c.goal, name: c.name, notRun: "skipped: quota exhausted", checks: [], spec: null });
      console.log(`\n[goal ${c.goal}] ${c.name}  NOT RUN (quota exhausted)`);
      continue;
    }
    let history: UIMessage[] = [];
    let before = inspect(null);
    let error: string | undefined;
    try {
      for (const [i, turn] of c.turns.entries()) {
        if (i > 0) before = inspect(currentSpec(history)); // page before the edit
        ({ messages: history, model } = await askWithRetry(history, turn));
        await new Promise((r) => setTimeout(r, PAUSE_MS));
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    if (error && (isOverload(error) || isQuota(error))) {
      quotaHit ||= isQuota(error);
      results.push({ goal: c.goal, name: c.name, notRun: error.slice(0, 200), checks: [], spec: null });
      console.log(`\n[goal ${c.goal}] ${c.name}  NOT RUN (provider error: ${error.slice(0, 80)}…)`);
      continue;
    }

    const spec = currentSpec(history);
    const page = inspect(spec);
    const problems = spec ? findProblems(spec) : ["no page was built"];
    const checks = [
      { label: "page is valid", pass: !error && problems.length === 0, detail: problems.join("; ") },
      ...c.checks.map((ch) => {
        let pass = false;
        try {
          pass = !error && ch.test(page, before);
        } catch {} // a check that crashes (e.g. missing element) counts as a fail
        return { label: ch.label, pass };
      }),
    ];
    results.push({ goal: c.goal, name: c.name, error, checks, spec });

    const passed = checks.filter((x) => x.pass).length;
    console.log(`\n[goal ${c.goal}] ${c.name}  ${passed}/${checks.length}${error ? `  ERROR: ${error}` : ""}`);
    for (const ch of checks) console.log(`   ${ch.pass ? "✓" : "✗"} ${ch.label}${!ch.pass && "detail" in ch && ch.detail ? `  (${ch.detail})` : ""}`);
  }

  // Summary per goal (cases that could not run are listed, not scored)
  const pct = (ok: number, n: number) => (n ? `${Math.round((100 * ok) / n)}%` : "n/a");
  console.log(`\n===== SCORE (model: ${model}) =====`);
  for (const goal of [1, 2, 3]) {
    const all = results.filter((r) => r.goal === goal).flatMap((r) => r.checks);
    const ok = all.filter((x) => x.pass).length;
    console.log(`Goal ${goal}: ${ok}/${all.length} checks passed (${pct(ok, all.length)})`);
  }
  const all = results.flatMap((r) => r.checks);
  const ok = all.filter((x) => x.pass).length;
  console.log(`TOTAL : ${ok}/${all.length} (${pct(ok, all.length)})`);
  const notRun = results.filter((r) => "notRun" in r && r.notRun);
  if (notRun.length) console.log(`NOT RUN (provider errors, rerun later): ${notRun.map((r) => r.name).join(", ")}`);

  mkdirSync("evals/results", { recursive: true });
  const file = `evals/results/${model}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ model, date: new Date().toISOString(), results }, null, 2));
  console.log(`Saved ${file}`);
}

main();
