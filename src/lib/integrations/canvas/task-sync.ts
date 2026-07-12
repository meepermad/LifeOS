import { createHash } from "crypto";
import type { CanvasSyncContext } from "@/lib/integrations/canvas/sync-context";
import type { NormalizedCanvasEvent } from "@/lib/integrations/canvas/schemas";
import type { CanvasEventForSync } from "@/lib/integrations/canvas/sync-data";
import {
  batchInsertCanvasTasks,
  batchUpdateCanvasTasks,
  cancelSyncManagedTasksForEvents,
  listCanvasTasksByRelatedEventIds,
  listCanvasTasksForSync,
  type CanvasTaskForSync,
  type CanvasTaskSyncInsert,
  type CanvasTaskSyncUpdate,
} from "@/lib/integrations/canvas/sync-data";
import type { TaskSyncResult } from "@/lib/integrations/canvas/schemas";

export type CanvasTaskContentHashInput = {
  title: string;
  description: string | null;
  dueAt: string;
  externalTaskId: string;
  relatedEventId: string;
  eventStatus: string;
};

export function buildCanvasTaskContentHash(input: CanvasTaskContentHashInput): string {
  const canonical = JSON.stringify({
    title: input.title,
    description: input.description,
    dueAt: input.dueAt,
    externalTaskId: input.externalTaskId,
    relatedEventId: input.relatedEventId,
    eventStatus: input.eventStatus,
  });

  return createHash("sha256").update(canonical).digest("hex");
}

function findExistingTask(
  event: CanvasEventForSync,
  byExternalId: Map<string, CanvasTaskForSync>,
  byRelatedEventId: Map<string, CanvasTaskForSync>,
): CanvasTaskForSync | undefined {
  if (event.external_event_id) {
    const byExternal = byExternalId.get(event.external_event_id);
    if (byExternal) {
      return byExternal;
    }
  }

  return byRelatedEventId.get(event.id);
}

function shouldPreserveUserStatus(task: CanvasTaskForSync): boolean {
  return (
    task.status === "completed" ||
    task.status === "deferred" ||
    task.status === "in_progress" ||
    (task.status === "cancelled" && !task.cancelled_by_sync)
  );
}

function hasUserCustomizedFields(task: CanvasTaskForSync): boolean {
  return (
    task.estimated_minutes != null ||
    task.remaining_minutes != null ||
    task.actual_minutes != null ||
    task.earliest_start_at != null ||
    task.priority !== 3 ||
    task.difficulty !== 3 ||
    !task.splittable ||
    task.minimum_block_minutes !== 25
  );
}

const ACTIVE_TASK_STATUSES = new Set(["open", "in_progress", "deferred"]);

export async function reconcileReclassifiedCanvasTasks(
  ctx: CanvasSyncContext,
  input: {
    parsedEvents: NormalizedCanvasEvent[];
    feedTrustworthy: boolean;
  },
): Promise<number> {
  if (!input.feedTrustworthy || input.parsedEvents.length === 0) {
    return 0;
  }

  const uidToEventType = new Map(
    input.parsedEvents.map((event) => [event.externalEventId, event.eventType]),
  );
  const externalIds = [...uidToEventType.keys()];

  const tasks = await listCanvasTasksForSync(ctx, externalIds);
  const toCancel: CanvasTaskSyncUpdate[] = [];

  for (const task of tasks) {
    if (!task.sync_managed || !task.external_task_id) {
      continue;
    }

    const feedEventType = uidToEventType.get(task.external_task_id);
    if (feedEventType !== "class" && feedEventType !== "other") {
      continue;
    }

    if (!ACTIVE_TASK_STATUSES.has(task.status)) {
      continue;
    }

    toCancel.push({
      id: task.id,
      title: task.title,
      description: task.description,
      external_task_id: task.external_task_id,
      due_at: task.due_at ?? new Date().toISOString(),
      related_event_id: task.related_event_id ?? "",
      source_content_hash: task.source_content_hash ?? "",
      sync_managed: true,
      status: "cancelled",
      cancelled_by_sync: true,
    });
  }

  if (toCancel.length === 0) {
    return 0;
  }

  await batchUpdateCanvasTasks(ctx, toCancel);
  return toCancel.length;
}

export async function syncCanvasTasksForDeadlineEvents(
  ctx: CanvasSyncContext,
  events: CanvasEventForSync[],
): Promise<TaskSyncResult> {
  const counts: TaskSyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    cancelled: 0,
    preservedUserFields: 0,
  };

  if (events.length === 0) {
    return counts;
  }

  const externalIds = events
    .map((event) => event.external_event_id)
    .filter((id): id is string => id != null);
  const eventIds = events.map((event) => event.id);

  const [tasksByExternal, tasksByRelated] = await Promise.all([
    listCanvasTasksForSync(ctx, externalIds),
    listCanvasTasksByRelatedEventIds(ctx, eventIds),
  ]);

  const byExternalId = new Map(
    tasksByExternal
      .filter((task) => task.external_task_id != null)
      .map((task) => [task.external_task_id!, task]),
  );
  const byRelatedEventId = new Map(
    [...tasksByExternal, ...tasksByRelated]
      .filter((task) => task.related_event_id != null)
      .map((task) => [task.related_event_id!, task]),
  );

  const toInsert: CanvasTaskSyncInsert[] = [];
  const toUpdate: CanvasTaskSyncUpdate[] = [];

  for (const event of events) {
    if (!event.external_event_id || event.event_type !== "deadline") {
      continue;
    }

    const contentHash = buildCanvasTaskContentHash({
      title: event.title,
      description: event.description,
      dueAt: event.end_at,
      externalTaskId: event.external_event_id,
      relatedEventId: event.id,
      eventStatus: event.status,
    });

    const existing = findExistingTask(event, byExternalId, byRelatedEventId);

    if (!existing) {
      const eventIsCancelled = event.status === "cancelled";
      toInsert.push({
        user_id: ctx.userId,
        title: event.title,
        description: event.description,
        source: "canvas",
        external_task_id: event.external_event_id,
        due_at: event.end_at,
        estimated_minutes: null,
        remaining_minutes: null,
        priority: 3,
        difficulty: 3,
        status: eventIsCancelled ? "cancelled" : "open",
        splittable: true,
        minimum_block_minutes: 25,
        related_event_id: event.id,
        sync_managed: true,
        cancelled_by_sync: eventIsCancelled,
        source_content_hash: contentHash,
      });
      counts.created += 1;
      if (eventIsCancelled) {
        counts.cancelled += 1;
      }
      continue;
    }

    if (existing.source_content_hash === contentHash) {
      counts.unchanged += 1;
      continue;
    }

    const update: CanvasTaskSyncUpdate = {
      id: existing.id,
      title: event.title,
      description: event.description,
      external_task_id: event.external_event_id,
      due_at: event.end_at,
      related_event_id: event.id,
      source_content_hash: contentHash,
      sync_managed: true,
    };

    const eventIsActive = event.status !== "cancelled";

    if (
      eventIsActive &&
      existing.status === "cancelled" &&
      existing.cancelled_by_sync
    ) {
      update.status = "open";
      update.cancelled_by_sync = false;
    } else if (!shouldPreserveUserStatus(existing)) {
      if (event.status === "cancelled") {
        update.status = "cancelled";
        update.cancelled_by_sync = true;
        counts.cancelled += 1;
      }
    }

    if (hasUserCustomizedFields(existing)) {
      counts.preservedUserFields += 1;
    }

    toUpdate.push(update);
    counts.updated += 1;
  }

  if (toInsert.length > 0) {
    await batchInsertCanvasTasks(ctx, toInsert);
  }
  if (toUpdate.length > 0) {
    await batchUpdateCanvasTasks(ctx, toUpdate);
  }

  return counts;
}

export async function reconcileCancelledCanvasTasks(
  ctx: CanvasSyncContext,
  input: {
    cancelledEventIds: string[];
    removalReconciliationRan: boolean;
  },
): Promise<number> {
  if (!input.removalReconciliationRan || input.cancelledEventIds.length === 0) {
    return 0;
  }

  return cancelSyncManagedTasksForEvents(ctx, input.cancelledEventIds);
}
