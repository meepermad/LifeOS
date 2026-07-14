import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimDelivery,
  isDeliveryComplete,
  isRetryableDeliveryStatus,
  suppressesDuplicateDelivery,
} from "@/lib/notifications/delivery";

describe("delivery claim / dedup semantics", () => {
  it("treats pending, sending, sent, and partial as suppressing", () => {
    expect(suppressesDuplicateDelivery("pending")).toBe(true);
    expect(suppressesDuplicateDelivery("sending")).toBe(true);
    expect(suppressesDuplicateDelivery("sent")).toBe(true);
    expect(suppressesDuplicateDelivery("partial")).toBe(true);
    expect(suppressesDuplicateDelivery("failed")).toBe(false);
    expect(suppressesDuplicateDelivery("skipped")).toBe(false);
  });

  it("does not treat skipped as a complete terminal success", () => {
    expect(isDeliveryComplete("skipped")).toBe(false);
    expect(isDeliveryComplete("sent")).toBe(true);
    expect(isRetryableDeliveryStatus("skipped")).toBe(true);
    expect(isRetryableDeliveryStatus("failed")).toBe(true);
  });

  describe("claimDelivery reclaim", () => {
    const updateEq = vi.fn();
    const updateIn = vi.fn();
    const updateSelect = vi.fn();
    const updateMaybeSingle = vi.fn();
    const insertSelect = vi.fn();
    const insertSingle = vi.fn();
    const selectMaybeSingle = vi.fn();

    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: selectMaybeSingle,
          })),
        })),
        insert: vi.fn(() => ({
          select: insertSelect,
        })),
        update: vi.fn(() => ({
          eq: updateEq,
        })),
      })),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      updateEq.mockReturnValue({
        in: updateIn.mockReturnValue({
          select: updateSelect.mockReturnValue({
            maybeSingle: updateMaybeSingle,
          }),
        }),
      });
      insertSelect.mockReturnValue({
        single: insertSingle,
      });
    });

    it("reclaims a premature skipped row", async () => {
      selectMaybeSingle
        .mockResolvedValueOnce({
          data: {
            id: "poison",
            deduplication_key: "daily_agenda:u:2026-07-14",
            status: "skipped",
          },
          error: null,
        });
      updateMaybeSingle.mockResolvedValue({
        data: {
          id: "poison",
          deduplication_key: "daily_agenda:u:2026-07-14",
          status: "pending",
        },
        error: null,
      });

      const result = await claimDelivery(client as never, {
        userId: "u",
        notificationType: "daily_agenda",
        scheduledFor: "2026-07-14T18:00:00.000Z",
        deduplicationKey: "daily_agenda:u:2026-07-14",
      });

      expect(result?.claimed).toBe(true);
      expect(result?.delivery.status).toBe("pending");
    });

    it("does not reclaim a sent row", async () => {
      selectMaybeSingle.mockResolvedValue({
        data: {
          id: "sent-1",
          deduplication_key: "daily_agenda:u:2026-07-14",
          status: "sent",
        },
        error: null,
      });

      const result = await claimDelivery(client as never, {
        userId: "u",
        notificationType: "daily_agenda",
        scheduledFor: "2026-07-14T18:00:00.000Z",
        deduplicationKey: "daily_agenda:u:2026-07-14",
      });

      expect(result?.claimed).toBe(false);
      expect(result?.delivery.status).toBe("sent");
    });

    it("creates a pending row when none exists", async () => {
      selectMaybeSingle.mockResolvedValue({ data: null, error: null });
      insertSingle.mockResolvedValue({
        data: {
          id: "new-1",
          deduplication_key: "daily_agenda:u:2026-07-14",
          status: "pending",
        },
        error: null,
      });

      const result = await claimDelivery(client as never, {
        userId: "u",
        notificationType: "daily_agenda",
        scheduledFor: "2026-07-14T18:00:00.000Z",
        deduplicationKey: "daily_agenda:u:2026-07-14",
      });

      expect(result?.claimed).toBe(true);
      expect(result?.delivery.id).toBe("new-1");
    });
  });
});
