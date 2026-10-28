import { mcpPost, mcpGet, mcpDelete } from "@/lib/mcpRoute";

export const dynamic = "force-dynamic";

export async function POST(req) {
  return mcpPost(req, req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
}
export const GET = mcpGet;
export const DELETE = mcpDelete;
