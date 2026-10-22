/**
 * SHARED · lib/spec.ts — rebuild "the page" from the chat history.
 *
 * The LLM never resends the whole page. Each answer contains PATCHES
 * ("add this element", "replace that prop"). To know what the page looks
 * like now, we replay every patch from every assistant message, in order.
 *
 * Used by:
 *   - server/agent.ts      : show the LLM the current page so edits are surgical
 *   - components/*         : live canvas + version history
 *   - evals/run.ts         : check the page the agent built
 */
import { applySpecPatch, nestedToFlat, SPEC_DATA_PART_TYPE, type Spec, type SpecDataPart } from "@json-render/core";
import type { UIMessage } from "ai";

export type Version = { messageId: string; spec: Spec };

/** Applies one message's spec parts on top of `base` and returns a NEW spec. */
export function applyMessage(base: Spec | null, message: UIMessage): Spec | null {
  let spec: Spec | null = base ? structuredClone(base) : null;
  for (const part of message.parts) {
    if (part.type !== SPEC_DATA_PART_TYPE) continue;
    const data = (part as { data: SpecDataPart }).data;
    if (data.type === "patch") {
      spec ??= { root: "", elements: {} };
      applySpecPatch(spec, data.patch);
    } else if (data.type === "flat") {
      spec = structuredClone(data.spec);
    } else {
      spec = nestedToFlat(data.spec);
    }
  }
  return spec;
}

/** One snapshot after every assistant message that changed the page (= version history). */
export function specVersions(messages: UIMessage[]): Version[] {
  const versions: Version[] = [];
  let spec: Spec | null = null;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    if (!message.parts.some((p) => p.type === SPEC_DATA_PART_TYPE)) continue;
    spec = applyMessage(spec, message);
    if (spec) versions.push({ messageId: message.id, spec });
  }
  return versions;
}

/** The page as it is right now (null = nothing built yet). */
export function currentSpec(messages: UIMessage[]): Spec | null {
  return specVersions(messages).at(-1)?.spec ?? null;
}

/** Counts elements reachable from the root (orphans left over from edits don't count). */
export function reachableElements(spec: Spec): Spec["elements"][string][] {
  const out: Spec["elements"][string][] = [];
  const seen = new Set<string>();
  const visit = (key: string) => {
    const el = spec.elements[key];
    if (!el || seen.has(key)) return;
    seen.add(key);
    out.push(el);
    el.children?.forEach(visit);
  };
  visit(spec.root);
  return out;
}
