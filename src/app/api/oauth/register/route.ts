import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createRegisteredClientId,
  isAllowedRedirectUri,
} from "@/lib/mcp/oauth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const registerSchema = z.object({
  client_name: z.string().trim().min(1).max(100).optional().default("AI Agent"),
  redirect_uris: z.array(z.string().min(1)).min(1).max(10),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional(),
  scope: z.string().optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * RFC 7591: OAuth 2.0 Dynamic Client Registration
 * Allows MCP clients (Claude, Cursor, ChatGPT, Antigravity) to self-register.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_client_metadata",
          error_description: "client_name and at least one valid redirect_uri are required",
        },
        { status: 400, headers: CORS }
      );
    }

    const { client_name, redirect_uris } = parsed.data;
    for (const uri of redirect_uris) {
      if (!isAllowedRedirectUri(uri)) {
        return NextResponse.json(
          {
            error: "invalid_redirect_uri",
            error_description: `Disallowed redirect_uri: ${uri}`,
          },
          { status: 400, headers: CORS }
        );
      }
    }

    const clientId = createRegisteredClientId(client_name, redirect_uris);
    const issuedAt = Math.floor(Date.now() / 1000);

    return NextResponse.json(
      {
        client_id: clientId,
        client_name,
        redirect_uris,
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        client_id_issued_at: issuedAt,
      },
      { status: 201, headers: CORS }
    );
  } catch {
    return NextResponse.json(
      {
        error: "invalid_client_metadata",
        error_description: "Invalid JSON payload",
      },
      { status: 400, headers: CORS }
    );
  }
}
