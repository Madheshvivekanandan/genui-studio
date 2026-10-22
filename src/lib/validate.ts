/**
 * SHARED · lib/validate.ts — is the page the AI built actually correct?
 *
 * Three layers of checks (POC goal 3):
 *   1. Structure  (json-render validateSpec): root exists, children exist...
 *   2. Props      (catalog.validate, i.e. our Zod schemas): right types/values
 *   3. Our rules  (hand-written): things a schema can't express
 *
 * Used by the canvas (validation badge) and by the test suite.
 */
import { validateSpec, type Spec } from "@json-render/core";
import { catalog } from "./catalog";

export function findProblems(spec: Spec): string[] {
  const problems: string[] = [];

  // 1. Structure
  for (const issue of validateSpec(spec).issues) {
    if (issue.severity === "error") problems.push(issue.message);
  }

  // 2. Props, checked against the Zod schemas in catalog.ts
  const props = catalog.validate(spec);
  if (!props.success && props.error) {
    for (const e of props.error.issues.slice(0, 5)) problems.push(`${e.path.join(".")}: ${e.message}`);
  }

  // 3. Our own rules
  if (spec.elements[spec.root]?.type !== "Page") problems.push("Root element must be a Page");
  for (const [key, el] of Object.entries(spec.elements)) {
    if (el.type === "Columns" && el.children?.length !== 2) {
      problems.push(`${key}: Columns needs exactly 2 children (has ${el.children?.length ?? 0})`);
    }
    if (el.type === "Table") {
      const { columns, rows } = el.props as { columns: string[]; rows: string[][] };
      rows?.forEach((row, i) => {
        if (row.length !== columns?.length) problems.push(`${key}: row ${i} has ${row.length} cells, expected ${columns?.length}`);
      });
    }
  }
  return problems;
}
