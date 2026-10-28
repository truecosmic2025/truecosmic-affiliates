import { NextResponse } from "next/server";
import { findKey } from "./apiauth";
import { handleRpc } from "./mcp";

// Shared by /mcp (Authorization: Bearer <key>) and /mcp/<key> (for clients such as claude.ai custom
// connectors, which can't send a custom header). Treat a URL containing a key like a password.
export async function mcpPost(req, token) {
  const key = await findKey(token);
  if (!key) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid or missing API key" } }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m, key)))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }
  const out = await handleRpc(body, key);
  return out ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
}

// This server doesn't push server-initiated messages, so there is no SSE stream to open
export function mcpGet() {
  return new NextResponse("This MCP server is stateless and doesn't offer an SSE stream.", { status: 405, headers: { Allow: "POST" } });
}

export function mcpDelete() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
