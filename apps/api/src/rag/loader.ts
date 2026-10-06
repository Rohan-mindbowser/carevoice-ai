import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { RagDocument } from '@carevoice/schemas';

/**
 * Load .txt/.md documents from a directory into RagDocuments. PDF/DOCX loaders can be added here
 * later behind the same return shape, without touching the rest of the pipeline (spec §16).
 */
export async function loadDocumentsFromDir(dir: string): Promise<RagDocument[]> {
  const entries = await readdir(dir);
  const documents: RagDocument[] = [];
  for (const entry of entries) {
    const ext = extname(entry).toLowerCase();
    if (ext !== '.txt' && ext !== '.md') continue;
    const text = await readFile(join(dir, entry), 'utf8');
    if (text.trim().length === 0) continue;
    documents.push({
      documentId: basename(entry, ext),
      documentName: entry,
      sourceType: 'guideline',
      text,
    });
  }
  return documents;
}
