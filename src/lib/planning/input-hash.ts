import { createHash } from "crypto";
import type { WorkloadInputs } from "@/lib/planning/types";

function canonicalizeInputs(inputs: WorkloadInputs): string {
  const payload = {
    events: inputs.events
      .map((event) => ({
        id: event.id,
        start: event.startAt,
        end: event.endAt,
        type: event.eventType,
        status: event.status,
        blocks_time: event.blocksTime,
        all_day: event.allDay,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    tasks: inputs.tasks
      .map((task) => ({
        id: task.id,
        status: task.status,
        remaining: task.remainingMinutes,
        estimated: task.estimatedMinutes,
        due: task.dueAt,
        earliest: task.earliestStartAt,
        priority: task.priority,
        difficulty: task.difficulty,
        splittable: task.splittable,
        min_block: task.minimumBlockMinutes,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    availability: inputs.availabilityRules
      .map((rule) => ({
        day: rule.dayOfWeek,
        start: rule.availableStart,
        end: rule.availableEnd,
        enabled: rule.isEnabled,
      }))
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
    preferences: inputs.preferences,
    weekStartsOn: inputs.weekStartsOn,
    periodType: inputs.periodType,
    periodStart: inputs.periodStart.toISOString(),
    periodEnd: inputs.periodEnd.toISOString(),
    dayKeys: inputs.dayKeys,
  };

  return JSON.stringify(payload);
}

export function computeWorkloadInputHash(inputs: WorkloadInputs): string {
  return createHash("sha256").update(canonicalizeInputs(inputs)).digest("hex");
}
