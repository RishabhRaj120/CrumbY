import { Order } from "@/types/order";

/**
 * Escapes a cell value according to RFC 4180 CSV standard.
 * Wraps with double quotes if cell contains comma, quote, or newline.
 * Replaces internal quotes with double quotes (" -> "").
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // If cell contains commas, quotes, carriage returns, or line feeds, enclose in quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return str;
}

/**
 * Converts a list of Orders into standard RFC 4180 CSV string.
 */
export function generateOrdersCsv(orders: Order[]): string {
  const headers = [
    "Order ID",
    "Status",
    "Customer Name",
    "Product",
    "Quantity",
    "Weight",
    "Dietary Preference",
    "Fulfillment Method",
    "Requested Date (Original)",
    "Resolved Date (ISO)",
    "Requested Time",
    "Payment Amount",
    "Payment Currency",
    "Payment Method",
    "Payment Status (Reported)",
    "Notes",
    "Missing / Unverified Details",
    "Is Demo Order",
    "Created At",
  ];

  const rows = orders.map((order) => [
    order.id,
    order.status,
    order.customer_name || "",
    order.product || "",
    order.quantity !== null ? order.quantity : "",
    order.weight || "",
    order.dietary_preference || "",
    order.fulfillment_method,
    order.requested_date || "",
    order.resolved_date || "",
    order.requested_time || "",
    order.payment_amount !== null ? order.payment_amount : "",
    order.payment_currency || "",
    order.payment_method || "",
    order.payment_status,
    order.notes.join("; "),
    order.missing_or_unverified.join("; "),
    order.is_demo ? "YES" : "NO",
    order.created_at,
  ]);

  const csvLines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];

  return csvLines.join("\r\n");
}

/**
 * Triggers a browser download of the orders CSV file.
 */
export function downloadOrdersCsv(orders: Order[], filename = "crumbdesk-orders.csv"): void {
  if (typeof window === "undefined") return;

  const csvContent = generateOrdersCsv(orders);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
