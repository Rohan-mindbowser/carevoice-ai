import { useEffect, useRef } from 'react';
import { Stethoscope } from 'lucide-react';
import type { ChatMessage } from './types';
import { MessageBubble } from './MessageBubble';

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
      <Stethoscope className="h-10 w-10" aria-hidden />
      <div>
        <p className="text-sm font-medium text-foreground">How can I help?</p>
        <p className="text-sm">Try: “Find patient 12724066 and give me the latest lab results.”</p>
      </div>
    </div>
  );
}

export function MessageList({ messages, onRetry }: { messages: ChatMessage[]; onRetry?: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 px-4">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6" role="log" aria-label="Conversation">
      {messages.map((message, index) => {
        // Retry is only offered on the most recent assistant message that errored.
        const canRetry = index === messages.length - 1 && message.role === 'assistant' && message.status === 'error';
        return <MessageBubble key={message.id} message={message} onRetry={canRetry ? onRetry : undefined} />;
      })}
      <div ref={endRef} />
    </div>
  );
}
