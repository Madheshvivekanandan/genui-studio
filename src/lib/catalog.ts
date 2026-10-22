/**
 * SHARED · lib/catalog.ts — WHAT the AI is allowed to build.
 *
 * The "menu" of components, used on BOTH sides:
 *   - SERVER (server/agent.ts): catalog.prompt() turns this menu into
 *     instructions for the LLM.
 *   - BROWSER (components/registry.tsx): defineRegistry() makes us build a
 *     real React component for every item on the menu.
 *
 * Three groups:
 *   LAYOUT  — decide the page shape (Page, Stack, Grid, Columns, Card)   -> POC goal 1
 *   CONTENT — small bricks that go inside layouts                         -> POC goal 2
 *   (props) — Zod shapes + descriptions keep the AI on the rails          -> POC goal 3
 *
 * Rule for lib/: no secrets, no React, no AI calls.
 */
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

const tone = z.enum(["info", "success", "warning", "danger"]);
const dataPoints = z.array(z.object({ label: z.string(), value: z.number() })).min(1).max(24);

export const ACCENTS = ["blue", "violet", "emerald", "rose", "amber", "slate"] as const;

export const catalog = defineCatalog(schema, {
  components: {
    /* ---------- LAYOUT ---------- */
    Page: {
      props: z.object({
        title: z.string(),
        accent: z.enum(ACCENTS),
        mode: z.enum(["light", "dark"]),
      }),
      description:
        "ALWAYS the root element. Sets page title, accent colour (emerald = green, rose = red/pink, " +
        "amber = orange/yellow, violet = purple, slate = grey) and light/dark mode. Children stack vertically.",
    },
    Stack: {
      props: z.object({ gap: z.enum(["sm", "md", "lg"]).nullable() }),
      description: "Places children vertically, one under another.",
    },
    Grid: {
      props: z.object({ columns: z.number().int().min(1).max(4) }),
      description: "Places children in N equal columns. Use for rows of metrics, cards or features.",
    },
    Columns: {
      props: z.object({ ratio: z.enum(["1:1", "1:2", "2:1"]) }),
      description:
        "Exactly TWO children side by side. ratio 1:2 = narrow left + wide right; 2:1 = wide left + narrow right.",
    },
    Card: {
      props: z.object({ title: z.string().nullable(), description: z.string().nullable() }),
      description: "A bordered box with an optional title. Groups other components as children.",
    },

    /* ---------- CONTENT ---------- */
    Hero: {
      props: z.object({
        headline: z.string(),
        subheadline: z.string(),
        primaryCta: z.string().nullable(),
        secondaryCta: z.string().nullable(),
      }),
      description: "Big banner at the top of a landing page. No children.",
    },
    Heading: {
      props: z.object({ text: z.string(), level: z.enum(["h1", "h2", "h3"]) }),
      description: "A title line. No children.",
    },
    Text: {
      props: z.object({ body: z.string(), muted: z.boolean().nullable() }),
      description: "A paragraph of text. No children.",
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        change: z.string().nullable(),
        trend: z.enum(["up", "down", "flat"]).nullable(),
      }),
      description: 'One KPI number, e.g. label "Revenue", value "$48.2k", change "+12%". No children.',
    },
    BarChart: {
      props: z.object({ title: z.string(), data: dataPoints }),
      description: "Vertical bar chart comparing values. No children.",
    },
    LineChart: {
      props: z.object({ title: z.string(), data: dataPoints }),
      description: "Line chart for a trend over time (min 2 points). No children.",
    },
    Table: {
      props: z.object({
        columns: z.array(z.string()).min(1).max(6),
        rows: z.array(z.array(z.string())).max(15),
      }),
      description: "Data table. Every row must have exactly one cell per column. No children.",
    },
    List: {
      props: z.object({
        items: z.array(z.object({ title: z.string(), description: z.string().nullable() })).min(1).max(10),
      }),
      description: "Bulleted list of items with optional descriptions. No children.",
    },
    Badge: {
      props: z.object({ label: z.string(), tone }),
      description: "Small coloured status label. No children.",
    },
    Alert: {
      props: z.object({ tone, title: z.string(), body: z.string() }),
      description: "Highlighted message box (info / success / warning / danger). No children.",
    },
    Progress: {
      props: z.object({ label: z.string(), value: z.number().min(0).max(100) }),
      description: "Progress bar, value in percent 0-100. No children.",
    },
    Input: {
      props: z.object({
        label: z.string(),
        kind: z.enum(["text", "email", "password", "number", "textarea"]),
        placeholder: z.string().nullable(),
      }),
      description: "A form field. No children.",
    },
    Select: {
      props: z.object({ label: z.string(), options: z.array(z.string()).min(1) }),
      description: "A dropdown form field. No children.",
    },
    Button: {
      props: z.object({ label: z.string(), variant: z.enum(["primary", "secondary"]) }),
      description: "A button. No children.",
    },
  },
  actions: {},
});

/** Extra rules appended to json-render's generated prompt (POC goal 3). */
export const RULES = [
  "The root element MUST be a Page. Put everything else inside it.",
  "Follow explicit numbers exactly: '3 metrics' means exactly 3 Metric elements, '4 columns' means Grid columns 4.",
  "Keep the order the user asked for (first X, then Y means X appears before Y).",
  "Write literal prop values. Do NOT use $state, $item, $bindState or repeat: write every element explicitly.",
  "Use realistic sample data (names, numbers, dates). Never lorem ipsum.",
  "When editing an existing page, change ONLY what the user asked for and keep every other element and value identical.",
  "If the user asks for a completely different page, replace /root with a new Page element and build the new page.",
  "If something cannot be built with the available components, use the closest components and say so in one sentence.",
];

/**
 * The full system prompt: json-render writes it from the catalog + our rules.
 * Lives here (shared) so the server sends it AND the How-it-works page can show it.
 */
export function buildInstructions(): string {
  return catalog.prompt({
    mode: "inline", // the LLM writes one sentence, then the UI patches
    system: "You are GenUI Studio, an agent that builds web pages from a fixed component library.",
    customRules: RULES,
  });
}
