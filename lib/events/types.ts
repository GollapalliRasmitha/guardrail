// The security event vocabulary, shared by the API, the pages and (copied) by HomeHaat / Oppora.

export const SOURCES = ["homehaat", "oppora"] as const;
export type SourceId = (typeof SOURCES)[number];

export const SOURCE_INFO: Record<SourceId, { name: string; host: string; secretEnv: string }> = {
  homehaat: { name: "HomeHaat", host: "homehaat.vercel.app", secretEnv: "INGEST_SECRET_HOMEHAAT" },
  oppora: { name: "Oppora", host: "oppora-app.vercel.app", secretEnv: "INGEST_SECRET_OPPORA" },
};

export const EVENT_TYPES = [
  "login_failed",
  "login_success",
  "admin_login",
  "password_reset_requested",
  "password_reset_done",
  "rate_limited",
  "webhook_signature_failed",
  "payment_failed",
  "refund_issued",
  "suspicious_path",
  "permission_denied",
  "new_device_login",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** How each type looks in the UI. `tone` is only a hint for the dot colour; alerts (Stage 4) carry real severity. */
export const EVENT_INFO: Record<EventType, { label: string; tone: "bad" | "warn" | "info" }> = {
  login_failed: { label: "Failed login", tone: "warn" },
  login_success: { label: "Login", tone: "info" },
  admin_login: { label: "Admin login", tone: "warn" },
  password_reset_requested: { label: "Password reset asked", tone: "info" },
  password_reset_done: { label: "Password reset done", tone: "info" },
  rate_limited: { label: "Rate limited", tone: "warn" },
  webhook_signature_failed: { label: "Forged webhook", tone: "bad" },
  payment_failed: { label: "Payment failed", tone: "info" },
  refund_issued: { label: "Refund issued", tone: "info" },
  suspicious_path: { label: "Suspicious path", tone: "bad" },
  permission_denied: { label: "Permission denied", tone: "warn" },
  new_device_login: { label: "New device login", tone: "warn" },
};

/** The only keys allowed in an event's `meta`. Anything else is dropped: no surprise personal data. */
export const META_KEYS = [
  "reason", // e.g. "wrong_password", "unknown_email", "bad_signature"
  "limit", // which rate limit was hit, e.g. "signin"
  "role", // "buyer" / "seller" / "admin"
  "order_ref", // an order number (never card data)
  "amount_paise",
  "gateway", // "razorpay"
  "device", // short device label, e.g. "Chrome on Android"
  "count", // how many times, for summarised events
] as const;
