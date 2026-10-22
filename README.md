# GenUI Studio

A proof of concept for **Generative UI**: an AI agent builds web pages from plain-English requests, using only a fixed catalog of React components, and edits them on follow-up requests.

Built with the **Vercel AI SDK** (LLM calls and streaming) and **json-render** by Vercel Labs (component catalog, UI JSON format and renderer) on **Next.js 16**. The default model is Google Gemini, on the free tier.

---

## What it demonstrates

| POC goal | How it is shown |
|---|---|
| **1. One agent, many page layouts** | Layout components (`Page`, `Stack`, `Grid`, `Columns`, `Card`) let a single agent build dashboards, landing pages, forms and multi-column pages. |
| **2. Components built from smaller components** | The UI JSON is a tree: 14 content components (`Metric`, `BarChart`, `Table`, `Input`, …) nest inside the layout components. |
| **3. How well the agent follows instructions** | Strict prop schemas and explicit rules, surgical edits (only the requested change is patched), 3-layer validation, and an automated test suite that scores the agent. |

**Screens**

- **`/`**: chat on the left, live canvas on the right (Preview / JSON tabs, version history `v1 v2 …`, validation badge).
- **`/how-it-works`**: replays the last request in 13 steps with the real data: what was sent, what the LLM received and returned, the stream, the patches, the final JSON, and how it maps to components.

---

## Quick start

**Prerequisites:** Node.js 22 or later, and a Gemini API key (free at https://aistudio.google.com/apikey).

```bash
git clone https://github.com/Madheshvivekanandan/genui-studio.git
cd genui-studio
npm install
cp .env.example .env.local    # then paste your key into .env.local
npm run dev                   # open http://localhost:3000
```

### Configuration (`.env.local`)

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | Gemini API key |
| `GEMINI_MODEL` | no | Model id. Default `gemini-3.5-flash`. Use `gemini-flash-lite-latest` if the default model is overloaded or out of quota. |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run eval` | Instruction-following test suite (needs `npm run dev` running) |

---

## Demo script (about 3 minutes)

1. **Layouts**: click the *Sales dashboard* suggestion. Then *New page* → *Landing page*. Same agent, different page shapes.
2. **Composition**: open the **JSON** tab. The page is a tree: `Page → Grid → Metric`, `Card → Progress + Alert`.
3. **Instructions**: click *Replace the bar chart with a line chart*. Only the chart changes; compare **v1 / v2**.
4. **Under the hood**: click **How it works ↗** to walk through that request step by step.
5. **Evidence**: show the test results below.

---

## How it works

```
Browser                         Server                                         LLM
ChatScreen ──POST /api/chat──▶  route.ts ─▶ agent.ts
 (useChat)                                  ├ attaches the current page (edits)
                                            └ instructions from the catalog ───▶ Gemini
Canvas ◀── text + "data-spec" chunks ── pipeJsonRender ◀── 1 sentence + JSON patch lines
 └▶ patches applied → page JSON (spec) → validation → <Renderer> + registry → React components
```

1. **Catalog** (`src/lib/catalog.ts`): the components the agent may use, each with a Zod prop schema and a description, plus rules (exact counts, keep order, edit only what was asked).
2. **Instructions**: json-render's `catalog.prompt()` turns the catalog into the system prompt and teaches the output format: JSON Patch lines (RFC 6902).
3. **Edits**: the current page is rebuilt from earlier answers (`src/lib/spec.ts`) and sent with the new request, so the agent returns small patches instead of a new page.
4. **One LLM call**: `streamText` (AI SDK) sends instructions + conversation to Gemini, which streams back a sentence and patch lines.
5. **Stream sorting**: `pipeJsonRender` splits the text into chat text and `data-spec` parts on the way to the browser.
6. **Rendering**: the browser applies the patches to build the page JSON, validates it (`src/lib/validate.ts`), and json-render's `<Renderer>` maps each element's `type` to a React component in `src/components/registry.tsx`.

### Design decision: text patches, not tool calls

The AI SDK can also produce UI through **tool calling** (the model returns a `functionCall` whose arguments are the UI JSON). This POC uses json-render's **text-patch** approach instead:

| | Tool calling | json-render (this POC) |
|---|---|---|
| LLM output | `functionCall` with the UI JSON as arguments | plain text: a sentence + JSON patch lines |
| LLM calls per message | 1–2 | 1 |
| Format enforcement | by the provider, on tool arguments | by the instructions, then validated after the fact |
| Edits | usually the whole page is resent | small patches, e.g. one `replace` |

That's why `/how-it-works` reports **0 tool calls**. json-render can export the catalog as JSON Schema (`catalog.jsonSchema()`), so a tool-calling variant could be added and compared with the test suite.

---

## Project structure

`app/` holds routing only (the Next.js "store project files outside of `app`" strategy). All other code is grouped by where it runs.

```
src/
├── app/                      ROUTING: maps URLs to code
│   ├── page.tsx              /                → components/ChatScreen
│   ├── how-it-works/page.tsx /how-it-works    → components/HowItWorks
│   ├── api/chat/route.ts     POST /api/chat   → server/agent
│   └── layout.tsx            HTML shell
├── server/                   BACKEND (guarded by `import "server-only"`)
│   └── agent.ts              LLM call, instructions, edit context, streaming, trace
├── components/               FRONTEND (browser)
│   ├── ChatScreen.tsx        chat panel, suggestions, request recording
│   ├── Canvas.tsx            live preview, JSON view, versions, validation badge
│   ├── registry.tsx          React implementation of every catalog component
│   ├── HowItWorks.tsx        step-by-step replay of one request
│   └── traceStore.ts         records each request/response for HowItWorks
└── lib/                      SHARED (no secrets, no React)
    ├── catalog.ts            components, props, rules, instructions
    ├── spec.ts               rebuilds the page and its versions from chat messages
    ├── validate.ts           structure + props + custom-rule checks
    ├── trace.ts              types of the recorded trace
    └── sample-traces.json    a recorded real request, shown before you run anything
evals/                        instruction-following test suite
├── cases.ts                  test prompts and their checks (add cases here)
├── inspect.ts                helpers to query a built page
└── run.ts                    runner; results go to evals/results/ (git-ignored)
```

---

## Test results

`npm run eval` sends 11 test prompts (2 of them two-turn edits) to the running app, rebuilds each page and checks it with code, e.g. "exactly 4 Metric elements" or "metrics unchanged after the edit". Each page is also validated.

Run on 2026-10-22 with `gemini-3.5-flash` (free tier):

| Goal | Result |
|---|---|
| 1. Layouts: dashboard, landing page, form, two-column profile | 18 / 18 checks passed |
| 2. Composition: nested card, side-by-side cards | 8 / 8 checks passed |
| 3. Instructions: theme + exact count, order, chart-only edit | 12 / 12 checks passed |
| Not run (provider errors, not agent failures) | "Edit: theme only" (503 overload), "Unsupported request" (daily quota) |

**38 / 38 checks passed in every case that ran.** To re-run only the skipped cases:

```bash
EVAL_ONLY="Edit: theme only,Unsupported request" npm run eval
```

To compare models, change `GEMINI_MODEL`, restart `npm run dev` and run the suite again.

---

## Known limitations

- **Free-tier quota**: `gemini-3.5-flash` allows about 20 requests per day. A full eval run uses 13. *Quota exceeded* → switch `GEMINI_MODEL` or wait for the daily reset. *High demand (503)* → temporary; retry.
- **Model quality**: lighter models (e.g. `gemini-flash-lite-latest`) follow instructions less precisely, for example by adding sections that weren't asked for.
- **json-render is pre-1.0** (Vercel Labs, pinned to `0.21.1`): APIs may change between versions.
- **No persistence**: pages live in the browser session; *New page* or a reload starts over.
- **Display only**: buttons and form fields render but don't submit (json-render supports actions and state; not wired up here).

## Tech stack

| Package | Version | Role |
|---|---|---|
| `next` | 16.4 | Full-stack framework (routing, server, React) |
| `ai` / `@ai-sdk/react` | 7.x / 4.x | Vercel AI SDK: `streamText`, `useChat`, streaming |
| `@ai-sdk/google` | 4.x | Gemini provider |
| `@json-render/core` / `@json-render/react` | 0.21.1 | Catalog, prompt generation, stream parsing, renderer |
| `zod` | 4.x | Component prop schemas |
| `tailwindcss` | 4.x | Styling |
