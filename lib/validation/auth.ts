import { z } from "zod";

// Shared by the API (to validate requests) and the pages (for types). One source of truth.

export const signInBody = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(128), // strength is checked when the password is set, not at sign-in
});
export type SignInBody = z.infer<typeof signInBody>;

export const codeBody = z.object({
  code: z
    .string()
    .transform((v) => v.replace(/\s/g, "")) // "123 456" is fine
    .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code")),
});
export type CodeBody = z.infer<typeof codeBody>;

/** What the next screen is after a successful step. */
export type AuthNext = "code" | "setup-2fa" | "dashboard";
export type SignInResponse = { next: AuthNext };
export type SetupStartResponse = { qrDataUrl: string; secret: string; account: string };
export type OkResponse = { ok: true };
