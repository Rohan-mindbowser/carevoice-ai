import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { API_ROUTES, APP_NAME } from '@carevoice/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useChat } from './useChat';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { MessageList } from './MessageList';
import { Composer } from './Composer';

type ApiStatus = 'checking' | 'ok' | 'down';

function useApiHealth(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking');
  useEffect(() => {
    let cancelled = false;
    fetch(API_ROUTES.health)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('health'))))
      .then((d: { status?: string }) => !cancelled && setStatus(d.status === 'ok' ? 'ok' : 'down'))
      .catch(() => !cancelled && setStatus('down'));
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}

export function ChatView() {
  const tts = useTextToSpeech();
  const chat = useChat((text) => tts.speak(text));
  const apiStatus = useApiHealth();

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{APP_NAME}</h1>
          <Badge variant={apiStatus === 'ok' ? 'success' : apiStatus === 'down' ? 'muted' : 'muted'}>
            API: {apiStatus}
          </Badge>
        </div>
        {tts.supported && (
          <Button
            variant="ghost"
            size="sm"
            onClick={tts.toggle}
            aria-pressed={tts.enabled}
            aria-label={tts.enabled ? 'Disable spoken responses' : 'Enable spoken responses'}
            className={cn(tts.enabled && 'text-primary')}
          >
            {tts.enabled ? <Volume2 className="mr-1 h-4 w-4" /> : <VolumeX className="mr-1 h-4 w-4" />}
            {tts.enabled ? 'Voice on' : 'Voice off'}
          </Button>
        )}
      </header>

      <MessageList messages={chat.messages} onRetry={chat.retry} />
      <Composer onSend={chat.send} busy={chat.busy} />
    </div>
  );
}
