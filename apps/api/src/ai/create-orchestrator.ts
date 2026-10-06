import { getLlmClient } from './llm/create-llm-client.js';
import { getFhirClient } from '../fhir/create-fhir-client.js';
import { createToolRegistry } from '../mcp/tools/index.js';
import { getRagService } from '../rag/create-rag-service.js';
import { Orchestrator, type KnowledgeRetriever } from './orchestrator.js';
import { logger } from '../observability/logger.js';

let cached: Orchestrator | undefined;

/**
 * Builds the live orchestrator. The LLM and FHIR client are required; RAG is optional — if it isn't
 * configured, knowledge questions degrade gracefully. Throws (→ handled as 503) if the LLM key is
 * missing.
 */
export function getOrchestrator(): Orchestrator {
  if (cached) return cached;

  const llm = getLlmClient();
  const fhir = getFhirClient();
  const registry = createToolRegistry();

  let rag: KnowledgeRetriever | undefined;
  try {
    rag = getRagService();
  } catch {
    rag = undefined;
    logger.warn({ event: 'rag_unavailable' }, 'orchestrator.rag_disabled');
  }

  cached = new Orchestrator({ llm, registry, fhir, rag });
  return cached;
}
