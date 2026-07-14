import type { ReactNode } from "react";

function SkeletonBlock({
  className = "",
  "aria-hidden": ariaHidden = true,
}: {
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <div
      aria-hidden={ariaHidden}
      className={`rounded-lg bg-surface-elevated motion-safe:animate-pulse ${className}`}
    />
  );
}

export function LoadingStatus({ label = "Loading" }: { label?: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function TaskRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3"
        >
          <SkeletonBlock className="h-5 w-5 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-3/4 max-w-[16rem]" />
            <SkeletonBlock className="h-3 w-1/2 max-w-[10rem]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div
      className="space-y-2 rounded-xl border border-border bg-surface p-4"
      aria-hidden
    >
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="h-5 w-48" />
      <SkeletonBlock className="h-3 w-32" />
    </div>
  );
}

export function WorkloadSkeleton() {
  return (
    <div
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
      aria-hidden
    >
      <SkeletonBlock className="h-4 w-28" />
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-8 w-full" />
    </div>
  );
}

export function CalendarGridSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-surface"
      aria-hidden
    >
      <div className="flex border-b border-border">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex-1 border-r border-border p-2 last:border-r-0">
            <SkeletonBlock className="mx-auto h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="relative min-h-[28rem]">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="flex border-b border-border/60"
            style={{ height: "2.8rem" }}
          >
            <SkeletonBlock className="m-1 h-3 w-8 shrink-0" />
            <div className="flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-xl border border-border bg-surface p-4"
        >
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-3 w-48" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ReviewStepperSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-2 flex-1 rounded-full" />
        ))}
      </div>
      <SkeletonBlock className="h-6 w-40" />
      <SkeletonBlock className="h-4 w-64" />
      <div className="space-y-2">
        <SkeletonBlock className="h-12 w-full" />
        <SkeletonBlock className="h-12 w-full" />
        <SkeletonBlock className="h-12 w-full" />
      </div>
    </div>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-border bg-surface p-4"
          >
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-8 w-16" />
            <SkeletonBlock className="h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <div className="space-y-6">
      <LoadingStatus label="Loading Today" />
      <div>
        <SkeletonBlock className="mb-2 h-7 w-28" />
        <SkeletonBlock className="h-4 w-48" />
      </div>
      <EventCardSkeleton />
      <TaskRowSkeleton count={3} />
      <WorkloadSkeleton />
    </div>
  );
}

export function WorkWeekSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <SkeletonBlock className="h-6 w-40" />
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="space-y-2 rounded-xl border border-border bg-surface p-3"
        >
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export function GenericPageSkeleton({
  titleWidth = "w-32",
  children,
}: {
  titleWidth?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <LoadingStatus />
      <SkeletonBlock className={`h-7 ${titleWidth}`} />
      <SkeletonBlock className="h-4 w-56" />
      {children ?? <TaskRowSkeleton count={3} />}
    </div>
  );
}
