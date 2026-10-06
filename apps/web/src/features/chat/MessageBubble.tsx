import { Loader2, RotateCw, Stethoscope, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from './types';
import { ToolStatus } from './ToolStatus';
import { PatientDataView } from './PatientDataView';
import { Citations } from './Citations';

export function MessageBubble({ message, onRetry }: { message: ChatMessage; onRetry?: () => void }) {
  const isDoctor = message.role === 'doctor';

  return (
    <div className={cn('flex gap-3', isDoctor && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isDoctor ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
        aria-hidden
      >
        {isDoctor ? <User className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
      </div>

      <div className={cn('max-w-[80%] space-y-2', isDoctor && 'items-end')}>
        <div className="text-xs font-medium text-muted-foreground">
          {isDoctor ? 'You' : 'CareVoice AI'}
        </div>

        {/* Tool execution indicators + structured EHR data (assistant only). */}
        {!isDoctor && message.toolEvents && <ToolStatus events={message.toolEvents} />}
        {!isDoctor && message.patientData !== undefined && (
          <PatientDataView data={message.patientData} />
        )}

        {/* The prose answer. For the assistant this is AI-generated text, kept visually distinct
            from the structured "From EHR" cards above. */}
        {(message.text.length > 0 || message.status === 'streaming') && (
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
              isDoctor ? 'bg-primary text-primary-foreground' : 'bg-muted',
              message.status === 'error' && 'bg-red-50 text-red-700',
            )}
            aria-live={!isDoctor && message.status === 'streaming' ? 'polite' : undefined}
          >
            {message.text}
            {message.status === 'streaming' && message.text.length === 0 && (
              <Loader2 className="h-4 w-4 animate-spin" aria-label="Thinking" />
            )}
          </div>
        )}

        {/* Retryable service error (e.g. rate limit) — offer a one-click retry. */}
        {!isDoctor && message.status === 'error' && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} aria-label="Retry">
            <RotateCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}

        {!isDoctor && message.citations && message.citations.length > 0 && (
          <Citations citations={message.citations} />
        )}
      </div>
    </div>
  );
}
