import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { ToolEvent } from './types';

const LABELS: Record<string, string> = {
  find_patient: 'Searching patients',
  get_patient: 'Retrieving patient',
  get_latest_lab_results: 'Retrieving latest labs',
  get_observations: 'Retrieving observations',
  get_diagnostic_reports: 'Retrieving diagnostic reports',
  knowledge_search: 'Searching approved knowledge',
};

function label(name: string): string {
  return LABELS[name] ?? name;
}

/** Shows what the assistant is doing — the "clear tool execution state" the spec calls for (§3). */
export function ToolStatus({ events }: { events: ToolEvent[] }) {
  if (events.length === 0) return null;
  return (
    <ul className="mb-2 space-y-1" aria-label="Tool activity">
      {events.map((event) => (
        <li key={event.name} className="flex items-center gap-2 text-xs text-muted-foreground">
          {event.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {event.status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />}
          {event.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-600" aria-hidden />}
          <span>{label(event.name)}</span>
        </li>
      ))}
    </ul>
  );
}
