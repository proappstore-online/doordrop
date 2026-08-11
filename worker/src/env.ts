export interface Env {
  DB: D1Database;
  APP_ID: string;
  /**
   * HMAC key for verifying PAS session JWTs locally (#71).
   *
   * Set as a Worker secret, NOT a var — it is the signing key for every session
   * on the platform. Replaces the old FAS_API_BASE round-trip; see auth.ts.
   */
  SESSION_SIGNING_KEY: string;
}
