# CareVoice AI

AI-powered voice assistant for healthcare professionals — combines conversational AI (Gemini),
the Model Context Protocol (MCP), Retrieval-Augmented Generation (RAG), and FHIR R4 / Cerner EHR
integration to provide **secure, read-only** access to clinical information.

> **Core principle:** the LLM is never the source of truth for patient data. Patient facts come
> from FHIR/Cerner; stable knowledge comes from approved RAG content; Gemini only understands,
> reasons, selects tools, and synthesizes language.

The full architecture, roadmap, and design rationale live in the Phase 1 plan.

## Monorepo layout

```
carevoice-ai/
├── apps/
│   ├── api/        # Express backend (TS, strict). Health endpoints live now; AI/MCP/FHIR/RAG land per phase.
│   └── web/        # React + Vite + Tailwind v4 + shadcn/ui
├── packages/
│   ├── schemas/    # Shared Zod schemas (runtime source of truth) + inferred TS types
│   └── shared/     # Framework-agnostic shared constants (routes, app name)
├── tsconfig.base.json   # Shared strict TS compiler options
├── eslint.config.js     # Flat ESLint config (whole repo)
└── .env.example         # Copy to .env (never commit a real .env)
```

Internal packages ship as **TypeScript source** and are consumed directly via their `exports`
(no lib build step) — `tsx`, Vite, and `tsup` resolve the source.

## Prerequisites

- Node.js >= 20 (tested on 22)
- pnpm 10 (`corepack enable` will provide it)

## Getting started

```bash
corepack enable          # makes pnpm available
pnpm install
cp .env.example .env      # defaults boot the API with no external credentials
pnpm dev                  # runs api (http://localhost:3000) + web (http://localhost:5173)
```

The web app shows an **API: ok** badge once it reaches the backend (via the Vite dev proxy).

## Scripts (run from repo root)

| Script | What it does |
|---|---|
| `pnpm dev` | Runs API and web dev servers in parallel |
| `pnpm build` | Builds every app (`tsup` for api, `vite build` for web) |
| `pnpm test` | Runs the test suites (Vitest) |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm lint` | ESLint across the repo |
| `pnpm format` | Prettier write |

## Verify the API directly

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","service":"CareVoice AI","version":"0.1.0","uptimeSeconds":<n>}

curl http://localhost:3000/api/v1/readiness
# {"status":"ready","checks":{"server":"ok"}}
```

## Security & PHI notes

- `.env` is git-ignored. Never commit real credentials.
- Logs are PHI-safe: only correlation ids (requestId, conversationId, etc.) — never patient data,
  tokens, or raw FHIR.
- v1 is read-only against FHIR; no EHR writes.

## Status

Phase 2 complete: pnpm monorepo, strict TypeScript, Express API skeleton (Helmet/CORS/rate-limit/
Zod-validated env/PHI-safe logging/health + readiness), and the React/Vite/Tailwind/shadcn web
shell. Subsequent phases add Mock FHIR, the FHIR adapter, MCP tools, Gemini, RAG, the orchestrator,
streaming, voice, the full UI, security, and production hardening.
