import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./appwrite/server";
import { LiumApiError } from "./lium/client";

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof LiumApiError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        hint: err.hint,
        requestId: err.requestId,
      },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 400 }
    );
  }
  console.error("[api:error]", err);
  const message =
    err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
