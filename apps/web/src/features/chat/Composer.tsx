import { useState } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { cn } from '@/lib/utils';

export interface ComposerProps {
  onSend: (text: string) => void;
  busy: boolean;
}

/** Text input is always available (fallback); the mic adds voice when the browser supports it (§18). */
export function Composer({ onSend, busy }: ComposerProps) {
  const [text, setText] = useState('');
  const stt = useSpeechToText((transcript) => {
    // Fill the field with the recognized text so the clinician can review before sending.
    setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
  });

  const submit = () => {
    const content = text.trim();
    if (busy || content.length === 0) return;
    onSend(content);
    setText('');
  };

  const toggleMic = () => (stt.listening ? stt.stop() : stt.start());

  return (
    <div className="border-t bg-background px-4 py-3">
      {stt.listening && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          Listening… {stt.interim}
        </div>
      )}
      {stt.error && <div className="mb-2 text-xs text-red-600">{stt.error}</div>}

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {stt.supported && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleMic}
            aria-pressed={stt.listening}
            aria-label={stt.listening ? 'Stop voice input' : 'Start voice input'}
            className={cn(stt.listening && 'border-red-500 text-red-600')}
          >
            {stt.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}

        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask about a patient, labs, or a clinical question…"
          disabled={busy}
          aria-label="Message"
          autoFocus
        />

        <Button type="submit" size="icon" disabled={busy || text.trim().length === 0} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
