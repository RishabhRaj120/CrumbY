import { describe, it, expect } from "vitest";
import { escapeCsvCell, generateOrdersCsv } from "@/lib/csv";
import { Order } from "@/types/order";

describe("CSV Export Formatting & Escaping", () => {
  it("escapes cells containing commas, double quotes, and newlines per RFC 4180", () => {
    // Normal string
    expect(escapeCsvCell("Chocolate Cake")).toBe("Chocolate Cake");

    // String with comma
    expect(escapeCsvCell("Eggless, Nut-free")).toBe('"Eggless, Nut-free"');

    // String with double quotes
    expect(escapeCsvCell('Writing: "Happy Birthday"')).toBe(
      '"Writing: ""Happy Birthday"""'
    );

    // String with newline
    expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');

    // Null and undefined
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("TEST G: exports orders with special characters producing valid CSV", () => {
    const mockOrder: Order = {
      id: "ord_test_001",
      created_at: "2026-10-14T03:00:00.000Z",
      updated_at: "2026-10-14T03:00:00.000Z",
      status: "confirmed",
      raw_message: 'Cake with "berries", please!\nCall me on arrival.',
      customer_name: "Smith, John",
      product: "Berry Tart, Special Edition",
      quantity: 2,
      weight: "1.5 kg",
      requested_date: "Sunday, next week",
      resolved_date: "2026-10-18",
      requested_time: "17:00",
      dietary_preference: "eggless, gluten-free",
      fulfillment_method: "delivery",
      payment_amount: 1500,
      payment_currency: "INR",
      payment_method: "GPay",
      payment_status: "customer_reported_paid",
      notes: ['Deliver to "Tower A", 4th Floor', "Ring bell twice"],
      missing_or_unverified: ["Exact apartment number"],
      requires_confirmation: false,
      is_demo: false,
    };

    const csv = generateOrdersCsv([mockOrder]);

    // Check header exists
    expect(csv).toContain("Order ID,Status,Customer Name");

    // Check customer name with comma is properly wrapped
    expect(csv).toContain('"Smith, John"');

    // Check product with comma is wrapped
    expect(csv).toContain('"Berry Tart, Special Edition"');

    // Check quotes inside notes are escaped with double quotes
    expect(csv).toContain('""Tower A""');

    // Ensure separate requested_date and resolved_date fields
    expect(csv).toContain('"Sunday, next week"');
    expect(csv).toContain("2026-10-18");

    // Verify reported payment is explicit
    expect(csv).toContain("customer_reported_paid");
  });
});
