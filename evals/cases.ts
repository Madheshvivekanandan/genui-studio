/**
 * evals/cases.ts — the test prompts and what "correct" means for each.
 *
 * Every case: one or more user turns (2 turns = an edit test), then checks
 * written as code. Grouped by Saurabh's three POC goals.
 * Add your own cases here — that's how you measure a new model or prompt.
 */
import type { Page } from "./inspect";

export type Check = { label: string; test: (page: Page, before: Page) => boolean };
export type Case = { goal: 1 | 2 | 3; name: string; turns: string[]; checks: Check[] };

const str = (v: unknown) => String(v ?? "");

export const CASES: Case[] = [
  /* ---------- Goal 1: one agent, many page layouts ---------- */
  {
    goal: 1,
    name: "Sales dashboard",
    turns: ["Sales dashboard: 4 KPI metrics in a row, a bar chart of monthly revenue and a table of the top 5 customers"],
    checks: [
      { label: "exactly 4 Metrics", test: (p) => p.count("Metric") === 4 },
      {
        label: "metrics in a 4-column Grid",
        test: (p) => p.ofType("Grid").some((g) => p.props(g).columns === 4 && p.childrenOf(g).filter((c) => c.type === "Metric").length === 4),
      },
      { label: "has a BarChart", test: (p) => p.count("BarChart") === 1 },
      { label: "table has 5 rows", test: (p) => (p.props(p.ofType("Table")[0]).rows as unknown[] | undefined)?.length === 5 },
    ],
  },
  {
    goal: 1,
    name: "Landing page",
    turns: ["Landing page for a project-management app: a hero, then 3 feature cards in a grid, then a call-to-action button"],
    checks: [
      { label: "has a Hero", test: (p) => p.count("Hero") === 1 },
      {
        label: "3 Cards in a 3-column Grid",
        test: (p) => p.ofType("Grid").some((g) => p.props(g).columns === 3 && p.childrenOf(g).filter((c) => c.type === "Card").length === 3),
      },
      { label: "order: Hero, Grid, Button", test: (p) => p.inOrder("Hero", "Grid", "Button") },
    ],
  },
  {
    goal: 1,
    name: "Sign-up form",
    turns: ["Sign-up form card with name, email and password fields, a team-size dropdown and a submit button"],
    checks: [
      { label: "exactly 3 Inputs", test: (p) => p.count("Input") === 3 },
      { label: "email + password kinds", test: (p) => ["email", "password"].every((k) => p.ofType("Input").some((i) => p.props(i).kind === k)) },
      { label: "Select has options", test: (p) => ((p.props(p.ofType("Select")[0]).options as unknown[]) ?? []).length >= 2 },
      { label: "fields inside a Card", test: (p) => p.ofType("Card").some((c) => p.descendants(c).filter((d) => d.type === "Input").length === 3) },
      { label: "has a Button", test: (p) => p.count("Button") >= 1 },
    ],
  },
  {
    goal: 1,
    name: "Two-column profile",
    turns: ["Profile page in two columns: left a card with the person's name and role, right a list of 4 recent activities"],
    checks: [
      { label: "uses Columns", test: (p) => p.count("Columns") === 1 },
      { label: "list has 4 items", test: (p) => (p.props(p.ofType("List")[0]).items as unknown[] | undefined)?.length === 4 },
    ],
  },

  /* ---------- Goal 2: components built from small components ---------- */
  {
    goal: 2,
    name: "Nested health card",
    turns: ["A card titled 'Server Health' containing 3 progress bars and a warning alert"],
    checks: [
      { label: "Card titled Server Health", test: (p) => p.ofType("Card").some((c) => str(p.props(c).title).includes("Server Health")) },
      {
        label: "3 Progress inside that card",
        test: (p) => p.ofType("Card").some((c) => p.descendants(c).filter((d) => d.type === "Progress").length === 3),
      },
      {
        label: "warning Alert inside that card",
        test: (p) => p.ofType("Card").some((c) => p.descendants(c).some((d) => d.type === "Alert" && p.props(d).tone === "warning")),
      },
    ],
  },
  {
    goal: 2,
    name: "Two team cards",
    turns: ["Two cards side by side: 'Team A' with 2 metrics and 'Team B' with 2 metrics"],
    checks: [
      ...["Team A", "Team B"].map((team) => ({
        label: `${team} card has 2 Metrics`,
        test: (p: Page) =>
          p.ofType("Card").some((c) => str(p.props(c).title).includes(team) && p.descendants(c).filter((d) => d.type === "Metric").length === 2),
      })),
      { label: "side by side", test: (p) => p.count("Columns") + p.ofType("Grid").filter((g) => p.props(g).columns === 2).length >= 1 },
    ],
  },

  /* ---------- Goal 3: following instructions ---------- */
  {
    goal: 3,
    name: "Theme + exact count",
    turns: ["Dark mode with a green accent, showing exactly 2 metrics: uptime 99.9% and latency 120ms"],
    checks: [
      { label: "mode is dark", test: (p) => p.props(p.root).mode === "dark" },
      { label: "accent is emerald (green)", test: (p) => p.props(p.root).accent === "emerald" },
      { label: "exactly 2 Metrics", test: (p) => p.count("Metric") === 2 },
      { label: "values 99.9% and 120ms", test: (p) => ["99.9%", "120ms"].every((v) => p.ofType("Metric").some((m) => str(p.props(m).value).includes(v))) },
    ],
  },
  {
    goal: 3,
    name: "Order",
    turns: ["First a heading 'Q3 Report', then a line chart of weekly signups, then a table of regions"],
    checks: [
      { label: "heading text is Q3 Report", test: (p) => p.ofType("Heading").some((h) => str(p.props(h).text).includes("Q3 Report")) },
      { label: "order: Heading, LineChart, Table", test: (p) => p.inOrder("Heading", "LineChart", "Table") },
    ],
  },
  {
    goal: 3,
    name: "Edit: swap chart only",
    turns: ["Dashboard with 3 metrics and a bar chart", "Replace only the bar chart with a line chart"],
    checks: [
      { label: "LineChart added", test: (p) => p.count("LineChart") === 1 },
      { label: "BarChart removed", test: (p) => p.count("BarChart") === 0 },
      {
        label: "metrics unchanged",
        test: (p, before) => JSON.stringify(p.ofType("Metric").map((m) => m.props)) === JSON.stringify(before.ofType("Metric").map((m) => m.props)),
      },
    ],
  },
  {
    goal: 3,
    name: "Edit: theme only",
    turns: ["Landing page with a hero and 3 feature cards", "Make it dark with a rose accent"],
    checks: [
      { label: "mode is dark", test: (p) => p.props(p.root).mode === "dark" },
      { label: "accent is rose", test: (p) => p.props(p.root).accent === "rose" },
      { label: "hero text unchanged", test: (p, b) => JSON.stringify(p.props(p.ofType("Hero")[0])) === JSON.stringify(b.props(b.ofType("Hero")[0])) },
      { label: "same number of Cards", test: (p, b) => p.count("Card") === b.count("Card") },
    ],
  },
  {
    goal: 3,
    name: "Unsupported request",
    turns: ["Add a video player and a map of our offices"],
    checks: [{ label: "still a non-empty page", test: (p) => p.all.length > 1 }],
  },
];
