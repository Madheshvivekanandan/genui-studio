/**
 * FRONTEND · components/Canvas.tsx — the right-hand panel that shows the page.
 *
 * Shows one version of the page (default: the latest, live while streaming):
 *   - Preview tab : <Renderer> turns the spec into real components
 *   - JSON tab    : the raw spec the AI produced (great for demos)
 *   - badge       : validation result from lib/validate.ts
 */
import { autoFixSpec, type Spec } from "@json-render/core";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { useState } from "react";
import { registry } from "@/components/registry";
import type { Version } from "@/lib/spec";
import { findProblems } from "@/lib/validate";

type Props = {
  versions: Version[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  streaming: boolean;
};

export function Canvas({ versions, selectedIndex, onSelect, streaming }: Props) {
  const [tab, setTab] = useState<"preview" | "json">("preview");
  const version = versions[selectedIndex];

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-gray-100 dark:bg-gray-900">
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 text-sm dark:border-gray-800 dark:bg-gray-950">
        {(["preview", "json"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 ${tab === t ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-500"}`}
          >
            {t === "preview" ? "Preview" : "JSON"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {versions.map((_, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`rounded-md px-2 py-1 font-mono text-xs ${i === selectedIndex ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"}`}
            >
              v{i + 1}
            </button>
          ))}
        </div>
        {version && !streaming && <ValidationBadge spec={version.spec} />}
        {streaming && <span className="animate-pulse text-blue-600">building…</span>}
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {!version ? (
          <p className="p-10 text-center text-gray-400">The page the agent builds will appear here.</p>
        ) : tab === "json" ? (
          <pre className="p-4 text-xs leading-relaxed">{JSON.stringify(version.spec, null, 2)}</pre>
        ) : (
          <Preview spec={version.spec} streaming={streaming} />
        )}
      </div>
    </section>
  );
}

export function Preview({ spec, streaming }: { spec: Spec; streaming: boolean }) {
  // autoFixSpec repairs small, safe mistakes (e.g. "visible" put inside props).
  const fixed = autoFixSpec(spec).spec;
  return (
    // initialState: if the LLM ever uses {"$state": "/path"}, the data lives in spec.state.
    <JSONUIProvider registry={registry} initialState={fixed.state}>
      <Renderer spec={fixed} registry={registry} loading={streaming} />
    </JSONUIProvider>
  );
}

function ValidationBadge({ spec }: { spec: Spec }) {
  const problems = findProblems(spec);
  if (problems.length === 0) return <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-700">✓ valid</span>;
  return (
    <span title={problems.join("\n")} className="cursor-help rounded-md bg-amber-100 px-2 py-1 text-amber-700">
      ⚠ {problems.length} issue{problems.length > 1 ? "s" : ""}
    </span>
  );
}
