import { handleCodeRequest } from "@/lib/auth/code-route";

/** First sign-in only: confirm the app was set up correctly by typing one code. This turns 2FA on. */
export function POST(request: Request) {
  return handleCodeRequest(request, "setup");
}
