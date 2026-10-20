import {
  bigint,
  bigserial,
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { EVENT_TYPES, SOURCES } from "@/lib/events/types";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** The one person allowed to sign in. Created only by `npm run admin:create`. */
export const adminUser = pgTable("admin_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // Argon2id, PHC string (includes its own salt)
  totpSecretEnc: text("totp_secret_enc"), // AES-256-GCM encrypted; null until 2FA setup starts
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpLastStep: bigint("totp_last_step", { mode: "number" }).notNull().default(0), // stops code reuse
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A signed-in browser. Only the SHA-256 of the cookie token is stored, never the token itself. */
export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
    mfaPassed: boolean("mfa_passed").notNull().default(false), // false = password OK, code still needed
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ipHash: text("ip_hash").notNull(),
    userAgent: text("user_agent").notNull().default(""),
  },
  (t) => [index("session_user_idx").on(t.userId), index("session_expires_idx").on(t.expiresAt)],
);

/** Every sign-in try (password or 2FA code), for the login rate limit. IP and email are stored hashed. */
export const authAttempt = pgTable(
  "auth_attempt",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind", { enum: ["password", "totp"] }).notNull(),
    ipHash: text("ip_hash").notNull(),
    emailHash: text("email_hash"),
    ok: boolean("ok").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("auth_attempt_ip_idx").on(t.ipHash, t.createdAt),
    index("auth_attempt_email_idx").on(t.emailHash, t.createdAt),
  ],
);

export type AdminUser = typeof adminUser.$inferSelect;
export type Session = typeof session.$inferSelect;

// ---- Stage 2: events -------------------------------------------------------------------------------------------

/** One security event from HomeHaat or Oppora. Personal data is masked or hashed before it gets here. */
export const event = pgTable(
  "event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(), // also the live-stream cursor (always increasing)
    source: text("source", { enum: SOURCES }).notNull(),
    type: text("type", { enum: EVENT_TYPES }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    ip: inet("ip"), // wiped after 30 days (Stage 6); ip_hash stays for counting
    ipHash: text("ip_hash"),
    country: text("country"), // 2 letters, e.g. "IN"
    actor: text("actor"), // masked: "ra****@gmail.com"
    path: text("path"), // no query string
    method: text("method"),
    statusCode: integer("status_code"),
    userAgent: text("user_agent"),
    meta: jsonb("meta").$type<Record<string, string | number | boolean>>().notNull().default({}),
  },
  (t) => [
    index("event_source_time_idx").on(t.source, t.occurredAt),
    index("event_type_time_idx").on(t.type, t.occurredAt),
    index("event_ip_hash_time_idx").on(t.ipHash, t.occurredAt),
    index("event_received_idx").on(t.receivedAt),
  ],
);

/**
 * Every nonce a source has used. The UNIQUE (source, nonce) makes Postgres itself refuse a replayed request,
 * even if two copies arrive at the same moment. Rows older than 10 minutes are deleted (their timestamp is
 * already outside the 5-minute window, so they can't be replayed anyway).
 */
export const ingestNonce = pgTable(
  "ingest_nonce",
  {
    source: text("source", { enum: SOURCES }).notNull(),
    nonce: text("nonce").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.nonce] }),
    index("ingest_nonce_time_idx").on(t.source, t.createdAt),
  ],
);

export type EventRow = typeof event.$inferSelect;
