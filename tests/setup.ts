import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/today",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/actions/planning", () => ({
  generateTodayPlanAction: vi.fn(async () => ({ success: true, data: null })),
  generateWeeklyPlanAction: vi.fn(async () => ({ success: true, data: null })),
  regeneratePlanAction: vi.fn(async () => ({ success: true, data: null })),
  rejectAllPendingProposalsAction: vi.fn(async () => ({ success: true })),
  acceptProposalsAction: vi.fn(async () => ({
    success: true,
    data: { accepted: [], failed: [] },
  })),
  acceptProposalAction: vi.fn(async () => ({
    success: true,
    data: { eventId: "event-1", idempotent: false },
  })),
  rejectProposalAction: vi.fn(async () => ({ success: true })),
}));
