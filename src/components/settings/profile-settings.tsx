"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateProfileAction } from "@/lib/actions/settings";
import { SecondaryButton } from "@/components/forms/ui";

export function ProfileSettingsForm({
  weekStartsOn,
}: {
  weekStartsOn: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function updateWeekStart(value: 0 | 1) {
    startTransition(async () => {
      await updateProfileAction(value);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Week starts on</p>
      <div className="grid grid-cols-2 gap-2">
        <SecondaryButton
          disabled={isPending || weekStartsOn === 0}
          onClick={() => updateWeekStart(0)}
        >
          Sunday
        </SecondaryButton>
        <SecondaryButton
          disabled={isPending || weekStartsOn === 1}
          onClick={() => updateWeekStart(1)}
        >
          Monday
        </SecondaryButton>
      </div>
    </div>
  );
}
