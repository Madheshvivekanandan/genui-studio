/**
 * BACKEND · server/agent.ts — the agent. Runs ONLY on the server.
 *
 * Holds everything secret or AI-related: the model, the API key (read from
 * .env.local by the Google provider), the instructions, the stream handling.
 * Python equivalent: a service module your FastAPI endpoint calls.
 */
import "server-only"; // build fails if any browser file ever imports this one

import { google } from "@ai-sdk/google";
import { buildUserPrompt, pipeJsonRender } from "@json-render/core";
import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream, type ToolSet } from "ai";
import { buildInstructions } from "@/lib/catalog";
import { currentSpec } from "@/lib/spec";
import type { GenUIMessage, LlmCall, ServerTrace } from "@/lib/trace";

// Model name comes from .env.local so you can switch when one is overloaded.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

// Built once: json-render writes the instructions from our catalog + our rules.
const INSTRUCTIONS = buildInstructions();

export async function streamAgentReply(messages: GenUIMessage[]): Promise<Response> {
  const startedAt = Date.now();

  // 1. EDITS: if a page already exists, wrap the user's latest request with
  //    the current page, so the LLM changes only what was asked.
  //    (Without this the LLM wouldn't know what it built before.)
  const { messages: withPage, sentPrompt, editMode } = attachCurrentPage(messages);

  // 2. Ask the LLM.
  let rawOutput = ""; // collected for the How-it-works page
  const llmCalls: LlmCall[] = [];
  const result = streamText({
    model: google(MODEL),
    instructions: INSTRUCTIONS,
    messages: await convertToModelMessages(withPage), // browser format -> model format
    include: { requestBody: true }, // keep the exact HTTP body sent to Google (How-it-works page)
    onChunk: ({ chunk }) => {
      if (chunk.type === "text-delta") rawOutput += chunk.text;
    },
    // One "step" = one call to the LLM. Without tools there is exactly one.
    onStepEnd: (step) => {
      llmCalls.push({
        step: step.stepNumber,
        provider: step.model.provider,
        modelId: step.model.modelId,
        finishReason: step.finishReason,
        toolCalls: step.toolCalls.length,
        inputTokens: step.usage.inputTokens,
        outputTokens: step.usage.outputTokens,
        requestBody: parseBody(step.request.body),
      });
    },
    // Learning aid: print exactly what the LLM wrote, in the server terminal.
    onEnd: ({ text }) => console.log("\n----- RAW LLM OUTPUT -----\n" + text + "\n--------------------------\n"),
  });

  // 3. The LLM's output is plain TEXT mixing a sentence and JSON lines.
  //    pipeJsonRender() sorts it: sentence -> "text" parts, JSON lines ->
  //    "data-spec" parts. The browser receives them already separated.
  return createUIMessageStreamResponse({
    headers: { "x-genui-model": MODEL }, // lets the test suite report which model it measured
    stream: pipeJsonRender(
      toUIMessageStream<ToolSet, GenUIMessage>({
        stream: result.stream,
        onError: (error) => (error instanceof Error ? error.message : String(error)), // show real errors while learning
        // At the very end, attach a "trace" of what happened on the server.
        // It travels with the answer as message metadata (How-it-works page).
        messageMetadata: ({ part }) => {
          if (part.type !== "finish") return undefined;
          const trace: ServerTrace = {
            model: MODEL,
            durationMs: Date.now() - startedAt,
            instructionsChars: INSTRUCTIONS.length,
            editMode,
            sentPrompt,
            rawOutput,
            llmCalls,
          };
          return { trace };
        },
      }),
    ),
  });
}

/** The provider request body, with the (huge, always identical) system instructions shortened. */
function parseBody(body: unknown): unknown {
  let parsed = body;
  try {
    if (typeof body === "string") parsed = JSON.parse(body);
  } catch {
    return body;
  }
  const google = parsed as { systemInstruction?: { parts?: { text?: string }[] } };
  const text = google?.systemInstruction?.parts?.[0]?.text;
  if (!text) return parsed;
  return { ...google, systemInstruction: { parts: [{ text: `[${text.length} characters: the system instructions]` }] } };
}

function attachCurrentPage(messages: GenUIMessage[]) {
  const last = messages.at(-1);
  const request = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
  const page = currentSpec(messages);
  if (!page || last?.role !== "user") return { messages, sentPrompt: request, editMode: false };

  const sentPrompt = buildUserPrompt({ prompt: request, currentSpec: page });
  const wrapped: GenUIMessage = { ...last, parts: [{ type: "text", text: sentPrompt }] };
  return { messages: [...messages.slice(0, -1), wrapped], sentPrompt, editMode: true };
}
