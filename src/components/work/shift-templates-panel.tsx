"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorkShiftTemplateRow } from "@/types/domain";
import {
  deleteTemplateAction,
  saveTemplateAction,
} from "@/lib/actions/work-schedule";
import {
  FormField,
  inputClassName,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
} from "@/components/forms/ui";
import { formatAppDate } from "@/lib/dates/timezone";

type Props = {
  templates: WorkShiftTemplateRow[];
  dayKeys: string[];
  onApply: (template: WorkShiftTemplateRow, selectedDays: number[]) => void;
};

export function ShiftTemplatesPanel({ templates, dayKeys, onApply }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "16:30",
    unpaidBreakMinutes: 30,
    location: "",
    label: "",
  });

  function toggleDay(index: number) {
    setSelectedDays((current) =>
      current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index],
    );
  }

  function handleApply() {
    const template = templates.find((t) => t.id === selectedTemplate);
    if (!template || selectedDays.length === 0) return;
    onApply(template, selectedDays);
    setSelectedDays([]);
  }

  function handleSaveTemplate() {
    startTransition(async () => {
      await saveTemplateAction(form);
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(templateId: string) {
    startTransition(async () => {
      await deleteTemplateAction(templateId);
      router.refresh();
    });
  }

  return (
    <SectionCard title="Shift templates" description="Apply a template to selected days.">
      <div className="space-y-3">
        {templates.length === 0 ? (
          <p className="text-sm text-muted">No templates yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span>
                  {template.name}: {template.start_time}–{template.end_time}
                </span>
                <SecondaryButton onClick={() => handleDelete(template.id)} disabled={isPending}>
                  Delete
                </SecondaryButton>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <select
            className={inputClassName}
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            <option value="">Select template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {dayKeys.map((dateKey, index) => (
            <label key={dateKey} className="flex items-center gap-1 text-xs text-muted">
              <input
                type="checkbox"
                checked={selectedDays.includes(index)}
                onChange={() => toggleDay(index)}
              />
              {formatAppDate(`${dateKey}T12:00:00Z`, "EEE")}
            </label>
          ))}
        </div>

        <SecondaryButton
          onClick={handleApply}
          disabled={!selectedTemplate || selectedDays.length === 0}
        >
          Apply template to selected days
        </SecondaryButton>

        {!showForm ? (
          <SecondaryButton onClick={() => setShowForm(true)}>Add template</SecondaryButton>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Name" htmlFor="template-name">
              <input
                id="template-name"
                className={inputClassName}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
            <FormField label="Start" htmlFor="template-start">
              <input
                id="template-start"
                type="time"
                className={inputClassName}
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </FormField>
            <FormField label="End" htmlFor="template-end">
              <input
                id="template-end"
                type="time"
                className={inputClassName}
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </FormField>
            <PrimaryButton onClick={handleSaveTemplate} loading={isPending}>
              Save template
            </PrimaryButton>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
