import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { assertNotSanctionedCountry } from "@/lib/compliance";
import { createCreemCheckout } from "@/lib/creem";

const checkoutSchema = z.object({
  packId: z.enum(["pack_10", "pack_25", "pack_50", "pack_100"]),
});

export async function POST(req: NextRequest) {
  try {
    assertNotSanctionedCountry(req);
    const ctx = await requireAuth(req);
    const body = checkoutSchema.parse(await req.json());

    const session = await createCreemCheckout({
      packId: body.packId,
      userId: ctx.userId,
      email: ctx.email,
    });

    return NextResponse.json(session);
  } catch (err) {
    return handleApiError(err);
  }
}
