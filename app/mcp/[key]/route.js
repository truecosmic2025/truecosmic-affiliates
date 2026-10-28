import { mcpPost, mcpGet, mcpDelete } from "@/lib/mcpRoute";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  return mcpPost(req, params.key);
}
export const GET = mcpGet;
export const DELETE = mcpDelete;
