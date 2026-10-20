// Lost your phone? This turns 2FA off so the next sign-in sets it up again. Run: npm run admin:reset-2fa
// It needs direct access to the database (your computer + .env), which is the proof that it's really you.
import { db, pool, schema } from "@/lib/db";
import { ask } from "./prompt";

async function main() {
  if ((await ask("Turn 2FA off and sign out all devices? (y/n) ")).toLowerCase() !== "y") return;
  await db()
    .update(schema.adminUser)
    .set({ totpSecretEnc: null, totpEnabled: false, totpLastStep: 0, updatedAt: new Date() });
  await db().delete(schema.session); // every session of the one account
  console.log("2FA is off. Sign in again and scan the new QR code.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
