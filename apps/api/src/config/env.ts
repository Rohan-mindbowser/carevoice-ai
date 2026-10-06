import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Load .env before reading process.env. Monorepo-friendly: load the local .env, then the nearest
 * .env walking up to the repo root. dotenv doesn't override already-set vars, so local values win
 * and the root fills gaps. This lets a single root .env serve every workspace package (each runs
 * with its own cwd under pnpm). Missing files are fine — defaults apply.
 */
function loadEnvFiles(): void {
  loadDotenv();
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth++) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

loadEnvFiles();

/** Cerner's public, unauthenticated R4 sandbox tenant — works with zero credentials. */
export const CERNER_OPEN_SANDBOX_URL =
  'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d';

/** Treat an unset-or-blank env var as "not provided" so a `FOO=` line in .env doesn't fail URL validation. */
const blankToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const optionalString = () => z.preprocess(blankToUndefined, z.string().optional());
const optionalUrl = () => z.preprocess(blankToUndefined, z.url().optional());

/**
 * Environment schema (spec §32). Runtime basics are required-with-defaults so the API boots out of
 * the box. The FHIR backend defaults to Cerner's open sandbox, so clinical reads work with no
 * credentials. Integration secrets stay optional here and are enforced in the phases that use them.
 * Validation runs once at import time; the process fails fast on malformed config.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  FHIR_SOURCE: z.enum(['cerner']).default('cerner'),
  FHIR_TIMEOUT_MS: z.coerce.number().int().positive().default(50000),

  GOOGLE_GENAI_API_KEY: optionalString(),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),

  PINECONE_API_KEY: optionalString(),
  PINECONE_INDEX: optionalString(),
  // Embedding model + dimension for RAG. The dimension MUST match the Pinecone index's dimension.
  EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  EMBEDDING_DIM: z.coerce.number().int().positive().default(1024),

  // Defaults to the open sandbox; override with a secure endpoint + the OAuth vars below (Phase 12).
  CERNER_BASE_URL: z.preprocess(blankToUndefined, z.url().default(CERNER_OPEN_SANDBOX_URL)),
  CERNER_CLIENT_ID: optionalString(),
  CERNER_CLIENT_SECRET: optionalString(),
  CERNER_SCOPE: optionalString(),

  OAUTH_ISSUER: optionalString(),
  OAUTH_AUDIENCE: optionalString(),
  OAUTH_JWKS_URI: optionalUrl(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadConfig(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Print key names + messages only — never values (avoids leaking secrets/PHI, spec §21).
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadConfig();

/** Parsed, trimmed CORS allowlist. */
export const corsOrigins: string[] = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
