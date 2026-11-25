import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import {
  createAuthorizationCode,
  isAllowedRedirectUri,
  parseRegisteredClientId,
} from "@/lib/mcp/oauth";

const authorizeSchema = z.object({
  client_id: z.string().min(1).max(2048),
  redirect_uri: z.string().min(1).max(2048),
  code_challenge: z.string().min(32).max(256),
  code_challenge_method: z.literal("S256"),
  state: z.string().max(1024).optional(),
  scope: z.string().max(256).optional().default("mcp:tools"),
  key_label: z.string().trim().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSessionAuth(req);
    const body = authorizeSchema.parse(await req.json());

    if (!isAllowedRedirectUri(body.redirect_uri)) {
      return NextResponse.json(
        { error: "Invalid or disallowed redirect_uri" },
        { status: 400 }
      );
    }

    let clientName = body.key_label || "AI Agent";
    const registered = parseRegisteredClientId(body.client_id);
    if (registered) {
      if (!registered.redirectUris.includes(body.redirect_uri)) {
        return NextResponse.json(
          { error: "redirect_uri does not match registered client" },
          { status: 400 }
        );
      }
      if (!body.key_label) {
        clientName = registered.clientName;
      }
    } else if (!body.key_label) {
      clientName = body.client_id.slice(0, 60);
    }

    const code = createAuthorizationCode({
      userId: ctx.userId,
      clientId: body.client_id,
      clientName,
      redirectUri: body.redirect_uri,
      codeChallenge: body.code_challenge,
      codeChallengeMethod: "S256",
      scope: body.scope || "mcp:tools",
    });

    const redirectUrl = new URL(body.redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (body.state) {
      redirectUrl.searchParams.set("state", body.state);
    }

    return NextResponse.json({
      redirectUrl: redirectUrl.toString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
