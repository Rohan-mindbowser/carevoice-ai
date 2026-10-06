import type { Intent, RagSearchResult } from '@carevoice/schemas';

export interface ToolEvent {
  name: string;
  status: 'running' | 'ok' | 'error';
}

export type MessageStatus = 'streaming' | 'done' | 'error';

export interface ChatMessage {
  id: string;
  role: 'doctor' | 'assistant';
  text: string;
  status?: MessageStatus;
  intent?: Intent;
  toolEvents?: ToolEvent[];
  /** Normalized, authoritative EHR data (shape varies by tool) — rendered as structured cards. */
  patientData?: unknown;
  citations?: RagSearchResult[];
}
