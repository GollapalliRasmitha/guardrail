import { z } from "zod";

// Every secret and setting is read here, once, and checked. A missing or malformed value fails loudly at
// startup instead of quietly turning a security check off.
const base64Key = z
  .string()
  .min(1, "is empty")
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 random bytes in base64");

const schema = z.object({
  DATABASE_URL: z.url(),
  APP_URL: z.url(),
  ENCRYPTION_KEY: base64Key,
  HASH_SECRET: base64Key,
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // List the names only, never the values.
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ");
    throw new Error(`GuardRail settings are missing or wrong (check .env): ${problems}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => process.env.NODE_ENV === "production";
