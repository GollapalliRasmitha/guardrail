import "server-only";
import { cache } from "react";
import { demoWorld } from "./world";

/** One demo world per request, shared by the demo layout and page (React's per-request cache). */
export const demoWorldForRequest = cache(() => demoWorld());
