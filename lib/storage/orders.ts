import { Order, DashboardStats } from "@/types/order";
import { orderSchema } from "../schemas/order";
import { SAMPLE_DEMO_ORDERS } from "./demo-data";

const STORAGE_KEY = "crumbdesk_orders_v1";
export const ORDERS_CHANGED_EVENT = "crumbdesk_orders_changed";

/**
 * Safely reads orders from localStorage.
 * Handles corrupt data gracefully without crashing.
 */
export function getStoredOrders(): Order[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("Stored orders is not an array; resetting.");
      return [];
    }

    // Validate each order record individually
    const validOrders: Order[] = [];
    for (const item of parsed) {
      const result = orderSchema.safeParse(item);
      if (result.success) {
        validOrders.push(result.data as Order);
      } else {
        console.warn("Filtered out invalid stored order record:", result.error);
      }
    }

    // Sort newest created first
    return validOrders.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (err) {
    console.warn("Error reading orders from localStorage:", err);
    return [];
  }
}

/**
 * Persists orders to localStorage and dispatches a change event.
 */
function setStoredOrders(orders: Order[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
  } catch (err) {
    console.error("Failed to save orders to localStorage:", err);
  }
}

/**
 * Adds a new order to storage.
 */
export function addOrder(order: Order): Order {
  const current = getStoredOrders();
  const existingIdx = current.findIndex((o) => o.id === order.id);

  let updated: Order[];
  if (existingIdx !== -1) {
    updated = [...current];
    updated[existingIdx] = { ...order, updated_at: new Date().toISOString() };
  } else {
    updated = [order, ...current];
  }

  setStoredOrders(updated);
  return order;
}

/**
 * Updates an existing order by ID.
 */
export function updateOrder(
  id: string,
  updates: Partial<Order>
): Order | null {
  const current = getStoredOrders();
  const index = current.findIndex((o) => o.id === id);

  if (index === -1) {
    return null;
  }

  const updatedOrder: Order = {
    ...current[index],
    ...updates,
    id, // preserve immutable ID
    updated_at: new Date().toISOString(),
  };

  const updatedList = [...current];
  updatedList[index] = updatedOrder;
  setStoredOrders(updatedList);
  return updatedOrder;
}

/**
 * Deletes an order by ID.
 */
export function deleteOrder(id: string): boolean {
  const current = getStoredOrders();
  const filtered = current.filter((o) => o.id !== id);

  if (filtered.length === current.length) {
    return false;
  }

  setStoredOrders(filtered);
  return true;
}

/**
 * Loads pre-defined demo orders into storage without overwriting
 * existing user-created orders.
 */
export function loadDemoOrders(): Order[] {
  const current = getStoredOrders();
  const nonDemoOrders = current.filter((o) => !o.is_demo);
  const merged = [...SAMPLE_DEMO_ORDERS, ...nonDemoOrders];
  setStoredOrders(merged);
  return merged;
}

/**
 * Removes only the sample demo orders, leaving real baker orders intact.
 */
export function removeDemoOrders(): void {
  const current = getStoredOrders();
  const remaining = current.filter((o) => !o.is_demo);
  setStoredOrders(remaining);
}

/**
 * Clears all orders (for settings/factory reset).
 */
export function clearAllOrders(): void {
  setStoredOrders([]);
}

/**
 * Calculates live dashboard statistics from an array of orders.
 */
export function calculateDashboardStats(orders: Order[]): DashboardStats {
  const totalOrders = orders.length;
  const needsReview = orders.filter((o) => o.status === "needs_review").length;
  const confirmed = orders.filter((o) => o.status === "confirmed").length;

  // Upcoming: orders that have a resolved date in future/today, or a requested date
  const nowStr = new Date().toISOString().split("T")[0];
  const upcomingFulfillments = orders.filter((o) => {
    if (o.resolved_date) {
      return o.resolved_date >= nowStr;
    }
    return Boolean(o.requested_date);
  }).length;

  return {
    totalOrders,
    needsReview,
    confirmed,
    upcomingFulfillments,
  };
}
