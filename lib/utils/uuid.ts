// Centralized UUID Generation - Production Ready (universal-safe)
type RandomUUID = () => string;

/** Try global Web Crypto first (works in modern Node, browsers, Edge). */
function webRandomUUID(): RandomUUID | undefined {
  const g: any = globalThis as any;
  const fn = g?.crypto?.randomUUID;
  return typeof fn === "function" ? fn.bind(g.crypto) : undefined;
}

/** Try Node's crypto.randomUUID without breaking Edge (guarded require). */
function nodeRandomUUID(): RandomUUID | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("crypto") as { randomUUID?: RandomUUID };
    return typeof mod.randomUUID === "function" ? mod.randomUUID : undefined;
  } catch {
    return undefined; // Not available in Edge/browser bundles
  }
}

/** Final fallback (non-crypto). Prefer only for non-security IDs. */
function weakFallbackUUID(): string {
  // Timestamp + random; no hyphens, low collision risk for casual use.
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Unified strong UUID: web → node → weak fallback */
export function generateUUID(): string {
  const web = webRandomUUID();
  if (web) return web();
  const node = nodeRandomUUID();
  if (node) return node();
  return weakFallbackUUID();
}

/** Normalize prefix to safe characters and trim hyphens */
function normalizePrefix(prefix: string): string {
  const safe = prefix.trim().replace(/[^a-zA-Z0-9_-]/g, "_").replace(/-+$/g, "");
  return safe || "id";
}

/**
 * Generate a prefixed UUID for specific contexts
 * @param prefix - Prefix to add to the UUID (sanitized to [a-zA-Z0-9_-])
 */
export function generatePrefixedUUID(prefix: string): string {
  const p = normalizePrefix(prefix);
  return `${p}-${generateUUID()}`;
}

/**
 * Generate a client-safe UUID (browser-first)
 * Falls back to timestamp + random if crypto is missing
 */
export function generateClientUUID(): string {
  const web = webRandomUUID();
  return web ? web() : weakFallbackUUID();
}

/** Convenience helpers with stable prefixes */
export const generateGoalId        = () => generatePrefixedUUID("goal");
export const generateTaskId        = () => generatePrefixedUUID("task");
export const generateStepId        = () => generatePrefixedUUID("step");
export const generateArtifactId    = () => generatePrefixedUUID("artifact");
export const generateSuggestionId  = () => generatePrefixedUUID("suggestion");
