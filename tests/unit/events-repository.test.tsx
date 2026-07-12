import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConflictError } from "@/lib/errors/app-error";
import { EventListItem, groupEventsByAppDay } from "@/components/events/event-list";
import type { EventWithCalendar } from "@/lib/data/events";

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { deleteEvent, updateEvent } from "@/lib/data/events";
import { getCalendarById } from "@/lib/data/calendars";

vi.mock("@/lib/data/calendars", () => ({
  getCalendarById: vi.fn(),
}));

const mockUser = {
  id: "user-1",
  email: "user@example.com",
};

function buildEvent(overrides: Partial<EventWithCalendar> = {}): EventWithCalendar {
  return {
    id: "event-1",
    user_id: "user-1",
    calendar_id: "calendar-1",
    external_event_id: null,
    title: "Meeting",
    description: null,
    location: null,
    start_at: "2026-07-11T15:00:00.000Z",
    end_at: "2026-07-11T16:00:00.000Z",
    all_day: false,
    status: "confirmed",
    source: "manual",
    event_type: "meeting",
    is_read_only: false,
    created_by_assistant: false,
    assistant_action_id: null,
    external_updated_at: null,
    content_hash: null,
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: "2026-07-11T00:00:00.000Z",
    calendar_name: "Manual",
    calendar_source: "manual",
    blocks_time: true,
    related_task_id: null,
    external_change_key: null,
    show_as: null,
    sensitivity: null,
    organizer_name: null,
    online_meeting_url: null,
    ...overrides,
  };
}

describe("authorization and repository scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects read-only event updates", async () => {
    vi.mocked(requireAllowedUser).mockResolvedValue(mockUser as never);

    const single = vi.fn().mockResolvedValue({
      data: buildEvent({ is_read_only: true }),
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single,
            })),
          })),
        })),
      })),
    } as never);

    vi.mocked(getCalendarById).mockResolvedValue({
      id: "calendar-1",
      is_writable: true,
    } as never);

    await expect(
      updateEvent("event-1", {
        title: "Updated",
        description: null,
        location: null,
        calendarId: "calendar-1",
        eventType: "meeting",
        status: "confirmed",
        allDay: false,
        startAt: "2026-07-11T15:00:00.000Z",
        endAt: "2026-07-11T16:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects read-only event deletes", async () => {
    vi.mocked(requireAllowedUser).mockResolvedValue(mockUser as never);

    const single = vi.fn().mockResolvedValue({
      data: buildEvent({ is_read_only: true }),
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single,
            })),
          })),
        })),
      })),
    } as never);

    await expect(deleteEvent("event-1")).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("week grouping", () => {
  it("groups events by America/Chicago date keys", () => {
    const grouped = groupEventsByAppDay([
      buildEvent({
        id: "a",
        start_at: "2026-07-11T05:00:00.000Z",
        end_at: "2026-07-11T06:00:00.000Z",
      }),
      buildEvent({
        id: "b",
        start_at: "2026-07-12T15:00:00.000Z",
        end_at: "2026-07-12T16:00:00.000Z",
      }),
    ]);

    expect(grouped.get("2026-07-11")?.map((event) => event.id)).toEqual(["a"]);
    expect(grouped.get("2026-07-12")?.map((event) => event.id)).toEqual(["b"]);
  });
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("canvas event display", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Canvas badge and no edit link for read-only events", () => {
    render(
      <EventListItem
        event={buildEvent({
          is_read_only: true,
          source: "canvas",
          calendar_source: "canvas",
          calendar_name: "Canvas",
          event_type: "deadline",
          blocks_time: false,
          title: "Assignment due",
        })}
      />,
    );

    expect(screen.getByText("Canvas")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.getByText(/Deadline/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Assignment due" })).not.toBeInTheDocument();
  });

  it("shows sync prompt for unlinked canvas deadline without task", () => {
    render(
      <EventListItem
        event={buildEvent({
          is_read_only: true,
          source: "canvas",
          calendar_source: "canvas",
          calendar_name: "Canvas",
          event_type: "deadline",
          blocks_time: false,
          title: "Assignment due",
        })}
      />,
    );

    expect(screen.getByText(/Sync Canvas to link this assignment/i)).toBeInTheDocument();
  });

  it("shows estimate workload for linked unestimated task", () => {
    render(
      <EventListItem
        event={buildEvent({
          is_read_only: true,
          source: "canvas",
          calendar_source: "canvas",
          calendar_name: "Canvas",
          event_type: "deadline",
          blocks_time: false,
          title: "Assignment due",
        })}
        relatedTask={{ id: "task-1", missingEstimate: true }}
      />,
    );

    expect(screen.getByRole("button", { name: "Estimate workload" })).toBeInTheDocument();
  });

  it("shows linked task for estimated canvas assignment", () => {
    render(
      <EventListItem
        event={buildEvent({
          is_read_only: true,
          source: "canvas",
          calendar_source: "canvas",
          calendar_name: "Canvas",
          event_type: "deadline",
          blocks_time: false,
          title: "Assignment due",
        })}
        relatedTask={{ id: "task-1", missingEstimate: false }}
      />,
    );

    expect(screen.getByRole("link", { name: "Linked task" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Estimate workload" })).not.toBeInTheDocument();
  });
});
