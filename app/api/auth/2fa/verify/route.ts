import { handleCodeRequest } from "@/lib/auth/code-route";

/** Step 2 of sign-in: the 6-digit code from the authenticator app. */
export function POST(request: Request) {
  return handleCodeRequest(request, "verify");
}
