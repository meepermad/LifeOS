"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  disconnectCanvasConnection,
  getCanvasConnectionSafe,
  saveCanvasFeedUrl,
} from "@/lib/data/connections";
import { syncCanvasCalendar } from "@/lib/integrations/canvas/sync";
import {
  canvasFeedUrlSchema,
  type CanvasSyncResult,
  type SafeCanvasConnectionStatus,
} from "@/lib/integrations/canvas/schemas";
import { AppError } from "@/lib/errors/app-error";

export type CanvasActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function toCanvasActionError<T = void>(error: unknown): CanvasActionResult<T> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return {
      success: false,
      error: "Validation failed",
      fieldErrors,
    };
  }

  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }

  return { success: false, error: "An unexpected error occurred" };
}

export async function saveCanvasFeedAction(
  url: string,
): Promise<CanvasActionResult<SafeCanvasConnectionStatus>> {
  try {
    const parsedUrl = canvasFeedUrlSchema.parse(url);
    const status = await saveCanvasFeedUrl(parsedUrl);
    revalidatePath("/imports");
    revalidatePath("/settings");
    return { success: true, data: status };
  } catch (error) {
    return toCanvasActionError(error);
  }
}

export async function disconnectCanvasAction(): Promise<CanvasActionResult> {
  try {
    await disconnectCanvasConnection();
    revalidatePath("/imports");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toCanvasActionError(error);
  }
}

export async function syncCanvasAction(): Promise<CanvasActionResult<CanvasSyncResult>> {
  try {
    const result = await syncCanvasCalendar();
    revalidatePath("/imports");
    revalidatePath("/settings");
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");
    return { success: true, data: result };
  } catch (error) {
    return toCanvasActionError(error);
  }
}

export async function getCanvasConnectionStatusAction(): Promise<SafeCanvasConnectionStatus> {
  return getCanvasConnectionSafe();
}
