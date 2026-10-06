import { randomUUID } from 'node:crypto';
import type { Intent, RagSearchResult } from '@carevoice/schemas';
import type { LlmClient } from './llm/llm-client.js';
import type { FHIRClient } from '../fhir/fhir-client.js';
import type { ToolRegistry } from '../mcp/registry.js';
import type { ToolError } from '../mcp/tool.js';
import type { AuthContext } from '../security/authorization.js';
import type { ChatStreamEvent } from '@carevoice/schemas';
import { runTool } from '../mcp/executor.js';
import { detectIntent } from './intent.js';
import { selectTool } from './tool-selection.js';
import { buildClinicalPrompt, generateClinicalResponse, type ClinicalResponseInput } from './response.js';
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
  /** Aborts streaming generation when the client disconnects. */
  signal?: AbortSignal;
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

/** How the reply is produced: a fixed deterministic message, or LLM generation from context. */
type Generation =
  | { kind: 'static'; text: string }
  | { kind: 'llm'; input: ClinicalResponseInput };

interface Resolution {
  partial: Omit<OrchestratorResult, 'reply'>;
  generation: Generation;
}

const noop = (): void => {};

/**
 * The turn lifecycle (spec §14): detect intent → route → (MCP/FHIR or RAG) → assemble context →
 * generate. Express-free and dependency-injected, so it is unit-testable in isolation. Patient data
 * (authoritative) and knowledge (reference) are kept strictly separate when building LLM context.
 *
 * {@link resolve} contains the single copy of the routing logic and emits streaming events as it
 * goes; {@link handleTurn} (non-streaming) and {@link streamTurn} (SSE) both build on it.
 */
export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  /** Non-streaming turn — returns the full result once the reply is generated. */
  async handleTurn(input: OrchestratorInput): Promise<OrchestratorResult> {
    const { partial, generation } = await this.resolve(input, noop);
    const reply =
      generation.kind === 'static'
        ? generation.text
        : await generateClinicalResponse(this.deps.llm, generation.input);
    return { ...partial, reply };
  }

  /** Streaming turn — emits structured events then streams the reply tokens (spec §9). */
  async streamTurn(input: OrchestratorInput, emit: (event: ChatStreamEvent) => void): Promise<void> {
    const { partial, generation } = await this.resolve(input, emit);

    if (generation.kind === 'static') {
      emit({ type: 'token', text: generation.text });
    } else {
      const { system, prompt } = buildClinicalPrompt(generation.input);
      for await (const delta of this.deps.llm.generateTextStream({ system, prompt, signal: input.signal })) {
        if (input.signal?.aborted) break;
        emit({ type: 'token', text: delta });
      }
    }
    emit({ type: 'done', conversationId: partial.conversationId });
  }

  /** Shared routing. Emits intent/tool/data/citation events; returns the resolved generation plan. */
  private async resolve(
    input: OrchestratorInput,
    emit: (event: ChatStreamEvent) => void,
  ): Promise<Resolution> {
    const conversationId = input.conversationId ?? randomUUID();
    const intent = await detectIntent(this.deps.llm, input.message);
    logger.info(
      { event: 'turn', requestId: input.requestId, conversationId, intent: intent.intent },
      'orchestrator.turn',
    );
    emit({ type: 'intent', intent });

    if (intent.intent === 'unknown') {
      return { partial: { conversationId, intent }, generation: { kind: 'static', text: CLARIFY_MESSAGE } };
    }

    if (intent.intent === 'clinical_question') {
      if (!this.deps.rag) {
        return {
          partial: { conversationId, intent },
          generation: { kind: 'static', text: KNOWLEDGE_UNAVAILABLE_MESSAGE },
        };
      }
      emit({ type: 'tool', name: 'knowledge_search', status: 'running' });
      const citations = await this.deps.rag.search(intent.query ?? input.message, {
        topK: KNOWLEDGE_TOP_K,
        minScore: KNOWLEDGE_MIN_SCORE,
      });
      emit({ type: 'tool', name: 'knowledge_search', status: 'ok' });
      if (citations.length > 0) emit({ type: 'citations', citations });
      const knowledge = citations.length > 0 ? formatKnowledge(citations) : undefined;
      return {
        partial: { conversationId, intent, citations },
        generation: { kind: 'llm', input: { userMessage: input.message, knowledge } },
      };
    }

    // Patient-data path.
    const plan = selectTool(intent);
    if (!plan) {
      return {
        partial: { conversationId, intent },
        generation: { kind: 'static', text: NEEDS_PATIENT_ID_MESSAGE },
      };
    }

    emit({ type: 'tool', name: plan.toolName, status: 'running' });
    const result = await runTool(this.deps.registry, plan.toolName, plan.input, {
      auth: input.auth,
      requestId: input.requestId,
      fhir: this.deps.fhir,
    });

    if (!result.ok) {
      emit({ type: 'tool', name: plan.toolName, status: 'error' });
      return {
        partial: { conversationId, intent, toolUsed: { name: plan.toolName, ok: false } },
        generation: { kind: 'static', text: toolErrorMessage(result.error) },
      };
    }

    emit({ type: 'tool', name: plan.toolName, status: 'ok' });
    emit({ type: 'patient_data', data: result.data });
    return {
      partial: { conversationId, intent, toolUsed: { name: plan.toolName, ok: true }, patientData: result.data },
      generation: { kind: 'llm', input: { userMessage: input.message, patientData: result.data } },
    };
  }
}
