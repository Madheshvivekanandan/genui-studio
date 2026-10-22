/**
 * SHARED · lib/trace.ts — the shapes of the "trace" shown on the How-it-works page.
 *
 * A trace records what happened at each step of ONE chat turn:
 *   - ServerTrace : filled in by server/agent.ts, sent along with the answer
 *                   as AI SDK "message metadata" (things only the server knows)
 *   - Trace       : the full record, put together in the browser
 */
import type { Spec } from "@json-render/core";
import type { UIMessage } from "ai";

/** What only the server knows: sent to the browser as message metadata. */
export type ServerTrace = {
  model: string;
  durationMs: number;
  instructionsChars: number;
  /** true when the current page was attached so the LLM can edit it */
  editMode: boolean;
  /** the exact user message the LLM received (after the current page was attached) */
  sentPrompt: string;
  /** exactly what the LLM wrote, before pipeJsonRender sorted it */
  rawOutput: string;
  /** one entry per call the AI SDK made to the LLM ("step") */
  llmCalls: LlmCall[];
};

export type LlmCall = {
  step: number;
  provider: string;
  modelId: string;
  finishReason: string;
  toolCalls: number;
  inputTokens?: number;
  outputTokens?: number;
  /** the HTTP body the AI SDK sent to the provider (Google) for this call */
  requestBody: unknown;
};

/** Our chat message type: a normal AI SDK message whose metadata may carry a ServerTrace. */
export type GenUIMessage = UIMessage<{ trace?: ServerTrace }>;

/** Everything the How-it-works page shows for one turn. */
export type Trace = {
  id: string;
  at: string;
  userText: string;
  /** the JSON body useChat POSTed to /api/chat */
  requestBody: string;
  /** the Server-Sent-Events lines that came back; runs of text-delta lines grouped into one */
  wire: string[];
  sseTotal: number;
  chunkCounts: Record<string, number>;
  /** the assistant message's parts, as useChat assembled them */
  parts: unknown[];
  versionBefore: number;
  specBefore: Spec | null;
  specAfter: Spec | null;
  problems: string[];
  server?: ServerTrace;
};
