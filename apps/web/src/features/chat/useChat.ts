import { useCallback, useRef, useState } from 'react';
import type { ChatStreamEvent } from '@carevoice/schemas';
import { streamChat } from '@/lib/sse';
import type { ChatMessage } from './types';

let idCounter = 0;
const nextId = (): string => `m${(idCounter += 1)}`;

/** Apply one SSE event to the in-progress assistant message. */
function applyEvent(message: ChatMessage, event: ChatStreamEvent): ChatMessage {
  switch (event.type) {
    case 'intent':
      return { ...message, intent: event.intent };
    case 'tool': {
      const others = (message.toolEvents ?? []).filter((t) => t.name !== event.name);
      return { ...message, toolEvents: [...others, { name: event.name, status: event.status }] };
    }
    case 'patient_data':
      return { ...message, patientData: event.data };
    case 'citations':
      return { ...message, citations: event.citations };
    case 'token':
      return { ...message, text: message.text + event.text };
    case 'done':
      return { ...message, status: 'done' };
    case 'error':
      // Service error (e.g. rate limit) — show the server message and mark retryable.
      return { ...message, status: 'error', text: event.message };
    default:
      return message;
  }
}

export interface UseChatResult {
  messages: ChatMessage[];
  busy: boolean;
  send: (text: string) => Promise<void>;
  /** Re-run the last turn (after a service error) without adding a duplicate user message. */
  retry: () => Promise<void>;
  stop: () => void;
}

/**
 * Owns conversation state and the streaming turn. Appends the clinician message + an empty
 * assistant message, then mutates the assistant message as SSE events arrive. Carries the
 * conversationId forward across turns.
 */
export function useChat(onAssistantDone?: (text: string) => void): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserTextRef = useRef<string>('');

  const patch = useCallback((id: string, updater: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }, []);

  const runTurn = useCallback(
    async (content: string, addUserBubble: boolean) => {
      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        ...(addUserBubble ? [{ id: nextId(), role: 'doctor', text: content } as ChatMessage] : []),
        { id: assistantId, role: 'assistant', text: '', status: 'streaming', toolEvents: [] },
      ]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          { message: content, conversationId: conversationIdRef.current },
          {
            signal: controller.signal,
            onEvent: (event) => {
              patch(assistantId, (m) => applyEvent(m, event));
              if (event.type === 'done') conversationIdRef.current = event.conversationId;
            },
          },
        );
      } catch {
        patch(assistantId, (m) => ({
          ...m,
          status: 'error',
          text: m.text || 'Sorry, something went wrong reaching the assistant. Please try again.',
        }));
      } finally {
        setBusy(false);
        abortRef.current = null;
        patch(assistantId, (m) => {
          const finalized: ChatMessage = m.status === 'streaming' ? { ...m, status: 'done' } : m;
          if (finalized.status === 'done' && finalized.text.length > 0) onAssistantDone?.(finalized.text);
          return finalized;
        });
      }
    },
    [patch, onAssistantDone],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (content.length === 0 || busy) return;
      lastUserTextRef.current = content;
      await runTurn(content, true);
    },
    [busy, runTurn],
  );

  const retry = useCallback(async () => {
    const content = lastUserTextRef.current;
    if (content.length === 0 || busy) return;
    // Drop the trailing (errored) assistant message, then re-run for the same user message.
    setMessages((prev) => {
      const copy = [...prev];
      if (copy[copy.length - 1]?.role === 'assistant') copy.pop();
      return copy;
    });
    await runTurn(content, false);
  }, [busy, runTurn]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { messages, busy, send, retry, stop };
}
