/**
 * ROUTING · app/api/chat/route.ts — the URL  POST /api/chat.
 *
 * Only wiring: read the request, hand it to the backend, return the answer.
 * Python equivalent:
 *   @app.post("/api/chat")
 *   async def post(req): return await stream_agent_reply((await req.json())["messages"])
 */
import type { GenUIMessage } from "@/lib/trace";
import { streamAgentReply } from "@/server/agent";

export async function POST(req: Request) {
  const { messages }: { messages: GenUIMessage[] } = await req.json();
  return streamAgentReply(messages);
}
