-- Runs once, when the Docker volume is first created.
-- guardrail_e2e is the THROWAWAY database: end-to-end tests wipe and refill it. Never point anything else at it.
CREATE DATABASE guardrail_e2e OWNER guardrail;
