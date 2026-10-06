import { randomUUID } from 'node:crypto';
import type { Intent, RagSearchResult } from '@carevoice/schemas';
import type { LlmClient } from './llm/llm-client.js';
import type { FHIRClient } from '../fhir/fhir-client.js';
import type { ToolRegistry } from '../mcp/registry.js';
import type { ToolError } from '../mcp/tool.js';
import type { AuthContext } from '../security/authorization.js';
import { runTool } from '../mcp/executor.js';
import { detectIntent } from './intent.js';
import { selectTool } from './tool-selection.js';
import { generateClinicalResponse } from './response.js';
import { logger } from '../observability/logger.js';

/** Minimal retrieval surface the orchestrator needs — RagService satisfies it structurally. */
export interface KnowledgeRetriever {
  search(query: string, options?: { topK?: number; minScore?: number }): Promise<RagSearchResult[]>;
}

export interface OrchestratorDeps {
  llm: LlmClient;
  registry: ToolRegistry;
  fhir: FHIRClient;
  /** Optional: knowledge answers are unavailable when RAG isn't configured. */
  rag?: KnowledgeRetriever;
}

export interface OrchestratorInput {
  message: string;
  conversationId?: string;
  auth: AuthContext;
  requestId: string;
}

export interface OrchestratorResult {
  conversationId: string;
  reply: string;
  intent: Intent;
  toolUsed?: { name: string; ok: boolean };
  patientData?: unknown;
  citations?: RagSearchResult[];
}

const CLARIFY_MESSAGE =
  'I can look up a patient, fetch their latest labs, observations, or diagnostic reports, or answer an approved clinical knowledge question. Could you rephrase your request?';

const NEEDS_PATIENT_ID_MESSAGE =
  'I need a patient ID to do that. Please provide the patient’s ID.';

const KNOWLEDGE_UNAVAILABLE_MESSAGE =
  'The approved knowledge base is not available right now.';

/** Deterministic, PHI-free messages for tool failures — never fabricate data (spec §39). */
function toolErrorMessage(error: ToolError): string {
  switch (error.kind) {
    case 'not_found':
      return "I couldn't find that patient or record in the EHR.";
    case 'forbidden':
      return 'You are not authorized to access that information.';
    case 'timeout':
      return 'The EHR took too long to respond. Please try again.';
    case 'unavailable':
      return 'The EHR is temporarily unavailable. Please try again.';
    case 'invalid_input':
      return "I couldn't complete that request with the information provided.";
    default:
      return "I couldn't retrieve that information from the EHR.";
  }
}

/** Format retrieved chunks for the KNOWLEDGE section, numbered so the model can reference sources. */
function formatKnowledge(results: RagSearchResult[]): string {
  return results
    .map(
      (result, i) =>
        `[${i + 1}] (${result.metadata.documentName}, chunk ${result.metadata.chunkIndex})\n${result.text}`,
    )
    .join('\n\n');
}

const KNOWLEDGE_MIN_SCORE = 0.4;
const KNOWLEDGE_TOP_K = 5;

/**
 * The turn lifecycle (spec §14): detect intent → route → (MCP/FHIR or RAG) → assemble context →
 * generate. Express-free and dependency-injected, so it is unit-testable in isolation. Keeps patient
 * data (authoritative) and knowledge (reference) strictly separated when building LLM context.
 */
export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async handleTurn(input: OrchestratorInput): Promise<OrchestratorResult> {
    const conversationId = input.conversationId ?? randomUUID();
    const intent = await detectIntent(this.deps.llm, input.message);
    logger.info(
      { event: 'turn', requestId: input.requestId, conversationId, intent: intent.intent },
      'orchestrator.turn',
    );

    if (intent.intent === 'unknown') {
      return { conversationId, intent, reply: CLARIFY_MESSAGE };
    }
    if (intent.intent === 'clinical_question') {
      return this.handleKnowledge(input, intent, conversationId);
    }
    return this.handlePatientData(input, intent, conversationId);
  }

  private async handlePatientData(
    input: OrchestratorInput,
    intent: Intent,
    conversationId: string,
  ): Promise<OrchestratorResult> {
    const plan = selectTool(intent);
    if (!plan) {
      return { conversationId, intent, reply: NEEDS_PATIENT_ID_MESSAGE };
    }

    const result = await runTool(this.deps.registry, plan.toolName, plan.input, {
      auth: input.auth,
      requestId: input.requestId,
      fhir: this.deps.fhir,
    });

    if (!result.ok) {
      // Deterministic, safe message — no LLM call, no fabrication.
      return {
        conversationId,
        intent,
        toolUsed: { name: plan.toolName, ok: false },
        reply: toolErrorMessage(result.error),
      };
    }

    const reply = await generateClinicalResponse(this.deps.llm, {
      userMessage: input.message,
      patientData: result.data,
    });
    return {
      conversationId,
      intent,
      toolUsed: { name: plan.toolName, ok: true },
      patientData: result.data,
      reply,
    };
  }

  private async handleKnowledge(
    input: OrchestratorInput,
    intent: Intent,
    conversationId: string,
  ): Promise<OrchestratorResult> {
    if (!this.deps.rag) {
      return { conversationId, intent, reply: KNOWLEDGE_UNAVAILABLE_MESSAGE };
    }

    const query = intent.query ?? input.message;
    const citations = await this.deps.rag.search(query, {
      topK: KNOWLEDGE_TOP_K,
      minScore: KNOWLEDGE_MIN_SCORE,
    });
    const knowledge = citations.length > 0 ? formatKnowledge(citations) : undefined;

    const reply = await generateClinicalResponse(this.deps.llm, {
      userMessage: input.message,
      knowledge,
    });
    return { conversationId, intent, reply, citations };
  }
}
