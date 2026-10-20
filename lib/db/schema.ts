import { bigint, bigserial, boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
