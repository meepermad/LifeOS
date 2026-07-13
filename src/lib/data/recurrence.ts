import { addDays, format } from "date-fns";
import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { getAppLocalDateKey } from "@/lib/dates/timezone";
import {
  buildOccurrenceDueAt,
  generateOccurrencesForTemplate,
} from "@/lib/recurrence/occurrences";
import { parseRecurrenceRule } from "@/lib/recurrence/rules";
import type {
  RecurrenceException,
  RecurrenceTemplate,
} from "@/lib/recurrence/types";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MaterializeResult = {
  generated: number;
  skipped: number;
  errors: number;
};

function mapTemplate(row: Record<string, unknown>): RecurrenceTemplate {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    task_category: (row.task_category as string | null) ?? null,
    course_id: (row.course_id as string | null) ?? null,
    default_estimate_minutes:
      (row.default_estimate_minutes as number | null) ?? null,
    default_priority: row.default_priority as number,
    default_difficulty: row.default_difficulty as number,
    recurrence_rule: parseRecurrenceRule(row.recurrence_rule),
    recurrence_timezone: row.recurrence_timezone as string,
    first_occurrence_date: row.first_occurrence_date as string,
    due_time: (row.due_time as string | null) ?? null,
    generation_horizon_days: row.generation_horizon_days as number,
    end_date: (row.end_date as string | null) ?? null,
    occurrence_limit: (row.occurrence_limit as number | null) ?? null,
    is_active: row.is_active as boolean,
    paused_at: (row.paused_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapException(row: Record<string, unknown>): RecurrenceException {
  return {
    id: row.id as string,
    template_id: row.template_id as string,
    occurrence_date: row.occurrence_date as string,
    exception_type: row.exception_type as RecurrenceException["exception_type"],
    moved_to_date: (row.moved_to_date as string | null) ?? null,
    override_title: (row.override_title as string | null) ?? null,
    override_estimate_minutes:
      (row.override_estimate_minutes as number | null) ?? null,
  };
}

export async function listRecurrenceTemplates(): Promise<RecurrenceTemplate[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_recurrence_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("title", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to load recurrence templates");
  }

  return (data ?? []).map((row) => mapTemplate(row as Record<string, unknown>));
}

export async function getRecurrenceTemplate(
  templateId: string,
): Promise<RecurrenceTemplate> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_recurrence_templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new DatabaseError("Recurrence template not found");
  }

  return mapTemplate(data as Record<string, unknown>);
}

export async function listExceptionsForTemplate(
  templateId: string,
): Promise<RecurrenceException[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_recurrence_exceptions")
    .select("*")
    .eq("template_id", templateId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to load recurrence exceptions");
  }

  return (data ?? []).map((row) => mapException(row as Record<string, unknown>));
}

export async function materializeTaskInstances(
  templateId: string,
  options?: { client?: SupabaseClient; userId?: string },
): Promise<MaterializeResult> {
  const user = options?.userId
    ? { id: options.userId }
    : await requireAllowedUser();
  const supabase = options?.client ?? (await createClient());

  const { data: templateRow, error: templateError } = await supabase
    .from("task_recurrence_templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", user.id)
    .single();

  if (templateError || !templateRow) {
    throw new DatabaseError("Recurrence template not found");
  }

  const template = mapTemplate(templateRow as Record<string, unknown>);

  if (!template.is_active || template.paused_at) {
    return { generated: 0, skipped: 0, errors: 0 };
  }

  const todayKey = getAppLocalDateKey(new Date());
  const horizonEnd = format(
    addDays(new Date(todayKey), template.generation_horizon_days),
    "yyyy-MM-dd",
  );

  const exceptions = await (async () => {
    const { data } = await supabase
      .from("task_recurrence_exceptions")
      .select("*")
      .eq("template_id", templateId)
      .eq("user_id", user.id);
    return (data ?? []).map((row) =>
      mapException(row as Record<string, unknown>),
    );
  })();

  const occurrences = generateOccurrencesForTemplate(template, {
    from: todayKey,
    to: horizonEnd,
    exceptions,
  });

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("recurrence_occurrence_key")
    .eq("recurrence_template_id", templateId)
    .eq("user_id", user.id);

  const existingKeys = new Set(
    (existingTasks ?? []).map((t) => t.recurrence_occurrence_key).filter(Boolean),
  );

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const occurrence of occurrences) {
    if (existingKeys.has(occurrence.occurrenceKey)) {
      skipped++;
      continue;
    }

    const ex = exceptions.find(
      (e) => e.occurrence_date === occurrence.originalDate,
    );
    if (ex?.exception_type === "skipped" || ex?.exception_type === "cancelled") {
      skipped++;
      continue;
    }

    const title = ex?.override_title ?? template.title;
    const estimate =
      ex?.override_estimate_minutes ?? template.default_estimate_minutes;
    const dueAt = buildOccurrenceDueAt(
      occurrence.scheduledDate,
      template.due_time,
      template.recurrence_timezone,
    );

    const status = "open";

    const { error: insertError } = await supabase.from("tasks").insert({
      user_id: user.id,
      title,
      description: template.description,
      source: "manual",
      due_at: dueAt,
      estimated_minutes: estimate,
      remaining_minutes: estimate,
      priority: template.default_priority,
      difficulty: template.default_difficulty,
      status,
      splittable: true,
      minimum_block_minutes: 25,
      course_id: template.course_id,
      recurrence_template_id: templateId,
      recurrence_occurrence_key: occurrence.occurrenceKey,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        skipped++;
      } else {
        errors++;
      }
      continue;
    }

    generated++;
    existingKeys.add(occurrence.occurrenceKey);
  }

  return { generated, skipped, errors };
}

export async function materializeAllActiveTemplates(
  options?: { client?: SupabaseClient; userId?: string },
): Promise<MaterializeResult> {
  const user = options?.userId
    ? { id: options.userId }
    : await requireAllowedUser();
  const supabase = options?.client ?? (await createClient());

  const { data: templates, error } = await supabase
    .from("task_recurrence_templates")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .is("paused_at", null);

  if (error) {
    throw new DatabaseError("Failed to load active templates");
  }

  const totals: MaterializeResult = { generated: 0, skipped: 0, errors: 0 };

  for (const template of templates ?? []) {
    try {
      const result = await materializeTaskInstances(template.id, {
        client: supabase,
        userId: user.id,
      });
      totals.generated += result.generated;
      totals.skipped += result.skipped;
      totals.errors += result.errors;
    } catch {
      totals.errors++;
    }
  }

  return totals;
}

export async function createRecurrenceTemplate(input: {
  title: string;
  description?: string | null;
  taskCategory?: string | null;
  courseId?: string | null;
  defaultEstimateMinutes?: number | null;
  defaultPriority?: number;
  defaultDifficulty?: number;
  recurrenceRule: unknown;
  recurrenceTimezone?: string;
  firstOccurrenceDate: string;
  dueTime?: string | null;
  generationHorizonDays?: number;
  endDate?: string | null;
  occurrenceLimit?: number | null;
}): Promise<RecurrenceTemplate> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const rule = parseRecurrenceRule(input.recurrenceRule);

  const { data, error } = await supabase
    .from("task_recurrence_templates")
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description ?? null,
      task_category: input.taskCategory ?? null,
      course_id: input.courseId ?? null,
      default_estimate_minutes: input.defaultEstimateMinutes ?? null,
      default_priority: input.defaultPriority ?? 3,
      default_difficulty: input.defaultDifficulty ?? 3,
      recurrence_rule: rule,
      recurrence_timezone: input.recurrenceTimezone ?? "America/Chicago",
      first_occurrence_date: input.firstOccurrenceDate,
      due_time: input.dueTime ?? null,
      generation_horizon_days: input.generationHorizonDays ?? 45,
      end_date: input.endDate ?? null,
      occurrence_limit: input.occurrenceLimit ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create recurrence template");
  }

  const template = mapTemplate(data as Record<string, unknown>);
  await materializeTaskInstances(template.id);
  return template;
}

export async function pauseRecurrenceTemplate(templateId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_recurrence_templates")
    .update({ paused_at: new Date().toISOString(), is_active: false })
    .eq("id", templateId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to pause recurrence template");
  }
}

export async function resumeRecurrenceTemplate(templateId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_recurrence_templates")
    .update({ paused_at: null, is_active: true })
    .eq("id", templateId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to resume recurrence template");
  }

  await materializeTaskInstances(templateId);
}

export async function skipRecurrenceOccurrence(
  templateId: string,
  occurrenceDate: string,
): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  await getRecurrenceTemplate(templateId);

  const { error } = await supabase.from("task_recurrence_exceptions").upsert(
    {
      user_id: user.id,
      template_id: templateId,
      occurrence_date: occurrenceDate,
      exception_type: "skipped",
    },
    { onConflict: "template_id,occurrence_date" },
  );

  if (error) {
    throw new DatabaseError("Failed to skip occurrence");
  }

  await supabase
    .from("tasks")
    .update({ status: "cancelled" })
    .eq("recurrence_template_id", templateId)
    .eq("recurrence_occurrence_key", occurrenceDate)
    .eq("user_id", user.id)
    .in("status", ["open", "in_progress", "deferred"]);
}

export async function moveRecurrenceOccurrence(
  templateId: string,
  occurrenceDate: string,
  movedToDate: string,
): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const template = await getRecurrenceTemplate(templateId);

  const { error } = await supabase.from("task_recurrence_exceptions").upsert(
    {
      user_id: user.id,
      template_id: templateId,
      occurrence_date: occurrenceDate,
      exception_type: "moved",
      moved_to_date: movedToDate,
    },
    { onConflict: "template_id,occurrence_date" },
  );

  if (error) {
    throw new DatabaseError("Failed to move occurrence");
  }

  const dueAt = buildOccurrenceDueAt(
    movedToDate,
    template.due_time,
    template.recurrence_timezone,
  );

  await supabase
    .from("tasks")
    .update({ due_at: dueAt })
    .eq("recurrence_template_id", templateId)
    .eq("recurrence_occurrence_key", occurrenceDate)
    .eq("user_id", user.id);
}
