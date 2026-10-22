/**
 * FRONTEND · components/registry.tsx — HOW each catalog item looks on screen.
 *
 * One entry per catalog component: "Metric" -> this JSX, "Grid" -> that JSX.
 * `props` = the values the LLM wrote. `children` = the child elements,
 * already rendered by json-render (that's how small components combine).
 *
 * Colours come from CSS variables set once by <Page>, so one instruction like
 * "make it dark and green" restyles every component at the same time.
 * Runs in the BROWSER. The LLM never sees this file.
 */
import { defineRegistry } from "@json-render/react";
import type { CSSProperties } from "react";
import { catalog, type ACCENTS } from "@/lib/catalog";

const ACCENT_HEX: Record<(typeof ACCENTS)[number], string> = {
  blue: "#2563eb",
  violet: "#7c3aed",
  emerald: "#059669",
  rose: "#e11d48",
  amber: "#d97706",
  slate: "#475569",
};
const MODES = {
  light: { "--bg": "#f8fafc", "--surface": "#ffffff", "--text": "#0f172a", "--muted": "#64748b", "--border": "#e2e8f0" },
  dark: { "--bg": "#0b1120", "--surface": "#111827", "--text": "#f1f5f9", "--muted": "#94a3b8", "--border": "#1f2937" },
};
const TONES = {
  info: "border-sky-500/40 bg-sky-500/10 text-sky-600",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  danger: "border-rose-500/40 bg-rose-500/10 text-rose-600",
};
const box = "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5";
const field =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

export const { registry } = defineRegistry(catalog, {
  components: {
    /* ---------- LAYOUT ---------- */
    Page: ({ props, children }) => {
      const accent = ACCENT_HEX[props.accent] ?? ACCENT_HEX.blue;
      // CSS variables aren't in React's style type, hence the cast.
      const theme = {
        ...(MODES[props.mode] ?? MODES.light),
        "--accent": accent,
        "--accent-soft": `color-mix(in srgb, ${accent} 14%, transparent)`,
      } as unknown as CSSProperties;
      return (
        <div style={theme} className="@container min-h-full space-y-6 bg-[var(--bg)] p-6 text-[var(--text)]">
          <p className="text-sm font-medium tracking-wide text-[var(--muted)] uppercase">{props.title}</p>
          {children}
        </div>
      );
    },
    Stack: ({ props, children }) => (
      <div className={{ sm: "space-y-2", md: "space-y-4", lg: "space-y-8" }[props.gap ?? "md"]}>{children}</div>
    ),
    Grid: ({ props, children }) => {
      // Container queries (@xl, @4xl) react to the canvas width, not the window.
      const cols = ["", "", "@xl:grid-cols-2", "@xl:grid-cols-2 @4xl:grid-cols-3", "@xl:grid-cols-2 @4xl:grid-cols-4"];
      return <div className={`grid grid-cols-1 gap-4 ${cols[props.columns] ?? ""}`}>{children}</div>;
    },
    Columns: ({ props, children }) => {
      const ratio = { "1:1": "@3xl:grid-cols-2", "1:2": "@3xl:grid-cols-[1fr_2fr]", "2:1": "@3xl:grid-cols-[2fr_1fr]" };
      return <div className={`grid grid-cols-1 gap-4 ${ratio[props.ratio]}`}>{children}</div>;
    },
    Card: ({ props, children }) => (
      <div className={`${box} space-y-4`}>
        {(props.title || props.description) && (
          <div>
            {props.title && <p className="font-semibold">{props.title}</p>}
            {props.description && <p className="text-sm text-[var(--muted)]">{props.description}</p>}
          </div>
        )}
        {children}
      </div>
    ),

    /* ---------- CONTENT ---------- */
    Hero: ({ props }) => (
      <div className="rounded-2xl bg-[var(--accent-soft)] px-8 py-12 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight">{props.headline}</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-[var(--muted)]">{props.subheadline}</p>
        <div className="mt-6 flex justify-center gap-3">
          {props.primaryCta && <Btn label={props.primaryCta} variant="primary" />}
          {props.secondaryCta && <Btn label={props.secondaryCta} variant="secondary" />}
        </div>
      </div>
    ),
    Heading: ({ props }) => {
      const size = { h1: "text-3xl font-bold", h2: "text-2xl font-semibold", h3: "text-lg font-semibold" };
      return <p className={size[props.level]}>{props.text}</p>;
    },
    Text: ({ props }) => (
      <p className={`leading-relaxed ${props.muted ? "text-[var(--muted)]" : ""}`}>{props.body}</p>
    ),
    Metric: ({ props }) => {
      const trend = props.trend ?? "flat";
      const color = { up: "text-emerald-500", down: "text-rose-500", flat: "text-[var(--muted)]" }[trend];
      return (
        <div className={box}>
          <p className="text-sm text-[var(--muted)]">{props.label}</p>
          <p className="mt-1 text-3xl font-semibold">{props.value}</p>
          {props.change && (
            <p className={`mt-1 text-sm font-medium ${color}`}>
              {{ up: "▲", down: "▼", flat: "■" }[trend]} {props.change}
            </p>
          )}
        </div>
      );
    },
    BarChart: ({ props }) => {
      const max = Math.max(...props.data.map((d) => d.value), 1);
      return (
        <div className={box}>
          <p className="mb-4 font-semibold">{props.title}</p>
          <div className="flex h-48 items-end gap-2">
            {props.data.map((d, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs text-[var(--muted)]">{d.value}</span>
                <div className="w-full rounded-t-md bg-[var(--accent)]" style={{ height: `${(d.value / max) * 100}%` }} />
                <span className="truncate text-xs text-[var(--muted)]">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    },
    LineChart: ({ props }) => {
      const values = props.data.map((d) => d.value);
      const min = Math.min(...values);
      const range = Math.max(...values) - min || 1;
      const step = props.data.length > 1 ? 100 / (props.data.length - 1) : 0;
      const points = props.data.map((d, i) => `${i * step},${38 - ((d.value - min) / range) * 36}`).join(" ");
      return (
        <div className={box}>
          <p className="mb-4 font-semibold">{props.title}</p>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full">
            <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
            <span>{props.data[0]?.label}</span>
            <span>{props.data.at(-1)?.label}</span>
          </div>
        </div>
      );
    },
    Table: ({ props }) => (
      <div className={`${box} overflow-x-auto`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted)]">
              {props.columns.map((c, i) => (
                <th key={i} className="py-2 pr-4 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, r) => (
              <tr key={r} className="border-b border-[var(--border)] last:border-0">
                {row.map((cell, c) => (
                  <td key={c} className="py-2 pr-4">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    List: ({ props }) => (
      <ul className="space-y-3">
        {props.items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--accent)]" />
            <div>
              <p className="font-medium">{item.title}</p>
              {item.description && <p className="text-sm text-[var(--muted)]">{item.description}</p>}
            </div>
          </li>
        ))}
      </ul>
    ),
    Badge: ({ props }) => (
      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[props.tone]}`}>
        {props.label}
      </span>
    ),
    Alert: ({ props }) => (
      <div className={`rounded-xl border p-4 ${TONES[props.tone]}`}>
        <p className="font-semibold">{props.title}</p>
        <p className="mt-1 text-sm text-[var(--text)] opacity-80">{props.body}</p>
      </div>
    ),
    Progress: ({ props }) => (
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span>{props.label}</span>
          <span className="text-[var(--muted)]">{props.value}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--border)]">
          <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${props.value}%` }} />
        </div>
      </div>
    ),
    Input: ({ props }) => (
      <label className="block text-sm font-medium">
        {props.label}
        {props.kind === "textarea" ? (
          <textarea className={field} rows={3} placeholder={props.placeholder ?? ""} />
        ) : (
          <input className={field} type={props.kind} placeholder={props.placeholder ?? ""} />
        )}
      </label>
    ),
    Select: ({ props }) => (
      <label className="block text-sm font-medium">
        {props.label}
        <select className={field}>
          {props.options.map((o, i) => (
            <option key={i}>{o}</option>
          ))}
        </select>
      </label>
    ),
    Button: ({ props }) => <Btn label={props.label} variant={props.variant} />,
  },
});

function Btn({ label, variant }: { label: string; variant: "primary" | "secondary" }) {
  const style =
    variant === "primary"
      ? "bg-[var(--accent)] text-white hover:opacity-90"
      : "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent-soft)]";
  return (
    <button type="button" className={`rounded-lg px-4 py-2 text-sm font-medium transition ${style}`}>
      {label}
    </button>
  );
}
