import type {
  CodeBody,
  OkResponse,
  SetupStartResponse,
  SignInBody,
  SignInResponse,
} from "@/lib/validation/auth";
import { apiFetch } from "./client";

// Typed functions for the auth API. Pages call these, never fetch() directly.

export const signIn = (body: SignInBody) =>
  apiFetch<SignInResponse>("/api/auth/signin", { method: "POST", body });

export const verifyCode = (body: CodeBody) =>
  apiFetch<SignInResponse>("/api/auth/2fa/verify", { method: "POST", body });

export const startSetup = () => apiFetch<SetupStartResponse>("/api/auth/2fa/setup", { method: "POST" });

export const confirmSetup = (body: CodeBody) =>
  apiFetch<SignInResponse>("/api/auth/2fa/setup/confirm", { method: "POST", body });

export const signOut = () => apiFetch<OkResponse>("/api/auth/signout", { method: "POST" });

export const signOutEverywhere = () => apiFetch<OkResponse>("/api/auth/signout-all", { method: "POST" });
