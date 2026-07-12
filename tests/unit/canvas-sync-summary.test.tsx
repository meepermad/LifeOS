import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CanvasSyncResult } from "@/lib/integrations/canvas/schemas";

function SyncSummary({ result }: { result: CanvasSyncResult }) {
  return (
    <div>
      <p>Canvas synchronization complete</p>
      <p>
        Events: {result.events.created} created, {result.events.updated} updated,{" "}
        {result.events.unchanged} unchanged
      </p>
      <p>
        Assignments: {result.tasks.created} tasks created, {result.tasks.updated} updated,{" "}
        {result.tasks.unchanged} unchanged
      </p>
      {result.tasks.preservedUserFields > 0 && (
        <p>{result.tasks.preservedUserFields} personal estimates preserved</p>
      )}
    </div>
  );
}

describe("canvas sync summary", () => {
  it("displays event and task counts", () => {
    render(
      <SyncSummary
        result={{
          events: { created: 2, updated: 1, unchanged: 14, cancelled: 0, warnings: 0 },
          tasks: {
            created: 2,
            updated: 1,
            unchanged: 7,
            cancelled: 0,
            preservedUserFields: 3,
          },
          warnings: 0,
        }}
      />,
    );

    expect(screen.getByText(/Canvas synchronization complete/i)).toBeInTheDocument();
    expect(screen.getByText(/2 created, 1 updated, 14 unchanged/i)).toBeInTheDocument();
    expect(screen.getByText(/2 tasks created, 1 updated, 7 unchanged/i)).toBeInTheDocument();
    expect(screen.getByText(/3 personal estimates preserved/i)).toBeInTheDocument();
  });
});
