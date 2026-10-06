import { ChatStreamEventSchema, type ChatRequest, type ChatStreamEvent } from '@carevoice/schemas';
import { API_ROUTES } from '@carevoice/shared';

export interface StreamChatHandlers {
  onEvent: (event: ChatStreamEvent) => void;
  signal?: AbortSignal;
}

/**
 * POST to the SSE chat endpoint and dispatch parsed events. Uses fetch + a stream reader (rather
 * than EventSource, which is GET-only) so we can send a JSON body. Each event is validated against
 * the shared schema before dispatch.
 */
export async function streamChat(body: ChatRequest, handlers: StreamChatHandlers): Promise<void> {
  const response = await fetch(API_ROUTES.chatStream, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Parse SSE frames (separated by a blank line); each `data:` line is one JSON event.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.replace(/^data: ?/, '').trim();
      if (line.length === 0) continue;
      try {
        const parsed = ChatStreamEventSchema.safeParse(JSON.parse(line));
        if (parsed.success) handlers.onEvent(parsed.data);
      } catch {
        // Ignore malformed frames rather than aborting the whole stream.
      }
    }
  }
}
