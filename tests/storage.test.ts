import { describe, it, expect, beforeEach } from "vitest";
import { orderSchema } from "@/lib/schemas/order";
import { SAMPLE_DEMO_ORDERS } from "@/lib/storage/demo-data";
import { calculateDashboardStats } from "@/lib/storage/orders";

describe("Storage Schema Validation & Dashboard Stats", () => {
  it("TEST F: validates sample demo orders against strict orderSchema", () => {
    for (const demoOrder of SAMPLE_DEMO_ORDERS) {
      const result = orderSchema.safeParse(demoOrder);
      expect(result.success).toBe(true);
      expect(demoOrder.is_demo).toBe(true);
    }
  });

  it("TEST F: safely rejects malformed or corrupted order records", () => {
    const corruptedRecord = {
      id: "", // invalid empty id
      status: "invalid_status", // invalid enum
      payment_status: "verified_paid", // invalid enum
      created_at: 12345, // invalid type
    };

    const result = orderSchema.safeParse(corruptedRecord);
    expect(result.success).toBe(false);
  });

  it("calculates live dashboard stats accurately", () => {
    const stats = calculateDashboardStats(SAMPLE_DEMO_ORDERS);
    expect(stats.totalOrders).toBe(4);
    expect(stats.needsReview).toBe(3);
    expect(stats.confirmed).toBe(1);
    expect(stats.upcomingFulfillments).toBeGreaterThanOrEqual(1);
  });
});
