import { FileText } from 'lucide-react';
import type { RagSearchResult } from '@carevoice/schemas';

/** Source attribution for knowledge answers (spec §17). */
export function Citations({ citations }: { citations: RagSearchResult[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-2 border-t pt-2">
      <div className="mb-1 text-xs font-medium text-muted-foreground">Sources</div>
      <ul className="space-y-1">
        {citations.map((citation, index) => (
          <li key={`${citation.metadata.documentId}:${citation.metadata.chunkIndex}`} className="flex items-start gap-2 text-xs">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-medium">{citation.metadata.documentName}</span>
              {citation.metadata.section ? ` — ${citation.metadata.section}` : ''}
              {typeof citation.metadata.page === 'number' ? `, p.${citation.metadata.page}` : ''}
              <span className="ml-1 text-muted-foreground">[{index + 1}]</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
