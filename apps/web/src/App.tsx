import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { API_ROUTES, APP_NAME } from '@carevoice/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ApiStatus = 'checking' | 'ok' | 'down';

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    fetch(API_ROUTES.health)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('health check failed'))))
      .then((data: { status?: string }) => {
        if (!cancelled) setApiStatus(data.status === 'ok' ? 'ok' : 'down');
      })
      .catch(() => {
        if (!cancelled) setApiStatus('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight">{APP_NAME}</h1>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              apiStatus === 'ok' && 'bg-emerald-100 text-emerald-700',
              apiStatus === 'down' && 'bg-red-100 text-red-700',
              apiStatus === 'checking' && 'bg-muted text-muted-foreground',
            )}
          >
            API: {apiStatus}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Clinical voice assistant — monorepo scaffold is live. Voice capture, chat, and patient /
            lab cards arrive in later phases.
          </p>
          <div className="mt-6 flex justify-center">
            <Button disabled>
              <Mic className="mr-2 h-4 w-4" />
              Speak
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
