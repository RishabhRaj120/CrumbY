import { OrderPolicySettings } from "@/types/order";
import { orderPolicySettingsSchema } from "../schemas/order";

const POLICY_SETTINGS_STORAGE_KEY = "crumbdesk_change_policy_v1";
export const POLICY_CHANGED_EVENT = "crumbdesk_policy_changed";

export const DEFAULT_CUTOFF_HOURS = 24;

export const CUTOFF_PRESET_OPTIONS = [12, 24, 48, 72] as const;

// In-memory fallback for SSR and test runners
let memorySettingsStore: string | null = null;

/**
 * Returns the browser's current IANA time zone identifier (e.g. "Asia/Kolkata", "America/New_York").
 */
export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local Browser Time";
  } catch {
    return "Local Browser Time";
  }
}

/**
 * Reads the order change policy settings from localStorage with safe defaults.
 */
export function getStoredPolicySettings(): OrderPolicySettings {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(POLICY_SETTINGS_STORAGE_KEY)
        : memorySettingsStore;

    if (!raw) {
      return { cutoff_hours: DEFAULT_CUTOFF_HOURS };
    }

    const parsed = JSON.parse(raw);
    const result = orderPolicySettingsSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }

    console.warn("Invalid policy settings found; falling back to defaults:", result.error);
    return { cutoff_hours: DEFAULT_CUTOFF_HOURS };
  } catch (err) {
    console.warn("Error reading policy settings from localStorage:", err);
    return { cutoff_hours: DEFAULT_CUTOFF_HOURS };
  }
}

/**
 * Saves the order change policy settings to localStorage and dispatches a change event.
 */
export function setStoredPolicySettings(settings: OrderPolicySettings): void {
  const result = orderPolicySettingsSchema.safeParse(settings);
  if (!result.success) {
    throw new Error(`Invalid policy settings: ${result.error.message}`);
  }

  const json = JSON.stringify(result.data);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(POLICY_SETTINGS_STORAGE_KEY, json);
      window.dispatchEvent(new Event(POLICY_CHANGED_EVENT));
    } catch (err) {
      console.error("Failed to save policy settings to localStorage:", err);
    }
  } else {
    memorySettingsStore = json;
  }
}
