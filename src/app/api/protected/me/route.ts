import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { errorResponse } from "@/lib/errors/error-response";

export async function GET() {
  try {
    const user = await requireAllowedUser();

    return NextResponse.json({
      message: "Protected route accessible",
      userId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
