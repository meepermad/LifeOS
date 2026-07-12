import { NextResponse } from "next/server";
import { AppError } from "./app-error";

function logUnexpectedError(error: unknown): void {
  if (error instanceof AppError) {
    console.error(`Handled application error: ${error.code}`);
    return;
  }

  if (error instanceof Error) {
    console.error(`Unexpected error: ${error.name}`);
    return;
  }

  console.error("Unexpected error: unknown");
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }

  logUnexpectedError(error);

  return NextResponse.json(
    { error: { code: "UNEXPECTED_ERROR", message: "An unexpected error occurred" } },
    { status: 500 },
  );
}
