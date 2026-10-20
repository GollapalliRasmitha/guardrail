// Creates the ONE GuardRail account, or changes its password. Run: npm run admin:create
// You type the email and password here in the terminal. Never paste them into a chat.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { checkPasswordStrength, hashPassword } from "@/lib/auth/password";
import { db, pool, schema } from "@/lib/db";
import { ask, askHidden } from "./prompt";

async function main() {
  const email = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .parse(await ask("Your email: "));

  const existing = await db().select().from(schema.adminUser);
  const other = existing.find((u) => u.email !== email);
  if (other) throw new Error("A different account already exists. GuardRail has exactly one account.");
  const sameUser = existing.find((u) => u.email === email);
  if (sameUser && (await ask("This account exists. Change its password? (y/n) ")).toLowerCase() !== "y")
    return;

  console.log(
    "Pick a password of 14+ characters. A few random words work well, e.g. 'copper-meadow-violin-river'.",
  );
  for (;;) {
    const password = await askHidden("Password (hidden): ");
    const problem = checkPasswordStrength(password, email);
    if (problem) {
      console.log(problem);
      continue;
    }
    if ((await askHidden("Type it again: ")) !== password) {
      console.log("They don't match. Try again.");
      continue;
    }
    const passwordHash = await hashPassword(password);
    if (sameUser) {
      await db()
        .update(schema.adminUser)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.adminUser.id, sameUser.id));
      await db().delete(schema.session).where(eq(schema.session.userId, sameUser.id)); // sign out everywhere
      console.log("Password changed. All devices were signed out.");
    } else {
      await db().insert(schema.adminUser).values({ email, passwordHash });
      console.log("Account created. Open the app and sign in: you'll be asked to set up 2FA first.");
    }
    return;
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError
        ? "That isn't a valid email."
        : error instanceof Error
          ? error.message
          : error,
    );
    process.exitCode = 1;
  })
  .finally(() => pool().end());
