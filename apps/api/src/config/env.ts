import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Load .env (if present) before reading process.env. Missing file is fine — defaults apply.
loadDotenv();

/**
 * Environment schema (spec §32). Runtime basics are required-with-defaults so the API boots
 * out of the box. Integration credentials (Gemini/Pinecone/Cerner/OAuth) are optional here and
 * are enforced in the phases that consume them. Validation runs once, at import time, and the
 * process fails fast on malformed config.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  FHIR_SOURCE: z.enum(['mock', 'cerner']).default('mock'),
  FHIR_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  GOOGLE_GENAI_API_KEY: z.string().optional(),

  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX: z.string().optional(),

  CERNER_BASE_URL: z.url().optional(),
  CERNER_CLIENT_ID: z.string().optional(),
  CERNER_CLIENT_SECRET: z.string().optional(),
  CERNER_SCOPE: z.string().optional(),

  OAUTH_ISSUER: z.string().optional(),
  OAUTH_AUDIENCE: z.string().optional(),
  OAUTH_JWKS_URI: z.url().optional(),
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
