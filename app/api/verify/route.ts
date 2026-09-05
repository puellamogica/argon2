import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/argon2";
import { validateVerifyRequest } from "@/lib/validate";
import type { VerifyResponse } from "./types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<VerifyResponse>> {
  try {
    const body = await request.json();
    const validation = validateVerifyRequest(body);

    if (!validation.valid) {
      return NextResponse.json({ success: false, errcode: 2 }, { status: 400 });
    }

    const result = await verifyPassword(
      validation.data!.stored_hash,
      validation.data!.user_input,
    );

    const status = result.errcode === 0 ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch {
    return NextResponse.json({ success: false, errcode: 4 }, { status: 500 });
  }
}
