import type { Document } from "@/document/types.ts";

export interface DocumentRevision {
  id: string;
  parentId: string | null;
  document: Document;
}

export interface RevisionSummary {
  id: string;
  parentId: string | null;
  isCurrent: boolean;
  isSaved: boolean;
}

export interface DocumentHistory {
  past: Document[];
  present: Document;
  future: Document[];
  saved: Document | null;
  pastRevisionIds: string[];
  presentRevisionId: string;
  futureRevisionIds: string[];
  savedRevisionId: string | null;
  revisions: ReadonlyMap<string, DocumentRevision>;
}

export function createHistory(document: Document, saved = false): DocumentHistory {
  const id = `rev_${crypto.randomUUID()}`;
  return {
    past: [], present: document, future: [], saved: saved ? document : null,
    pastRevisionIds: [], presentRevisionId: id, futureRevisionIds: [],
    savedRevisionId: saved ? id : null,
    revisions: new Map([[id, { id, parentId: null, document }]]),
  };
}

export function commit(history: DocumentHistory, document: Document): DocumentHistory {
  if (document === history.present) return history;
  const id = `rev_${crypto.randomUUID()}`;
  const revisions = new Map(history.revisions);
  revisions.set(id, { id, parentId: history.presentRevisionId, document });
  return {
    ...history,
    past: [...history.past, history.present],
    present: document,
    future: [],
    pastRevisionIds: [...history.pastRevisionIds, history.presentRevisionId],
    presentRevisionId: id,
    futureRevisionIds: [],
    savedRevisionId: history.savedRevisionId ?? (history.saved === document ? id : null),
    revisions,
  };
}

export function undo(history: DocumentHistory): DocumentHistory {
  if (history.past.length === 0) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    pastRevisionIds: history.pastRevisionIds.slice(0, -1),
    presentRevisionId: history.pastRevisionIds[history.pastRevisionIds.length - 1],
    futureRevisionIds: [history.presentRevisionId, ...history.futureRevisionIds],
  };
}

export function redo(history: DocumentHistory): DocumentHistory {
  if (history.future.length === 0) return history;
  return {
    ...history,
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    pastRevisionIds: [...history.pastRevisionIds, history.presentRevisionId],
    presentRevisionId: history.futureRevisionIds[0],
    futureRevisionIds: history.futureRevisionIds.slice(1),
  };
}

export function markSaved(history: DocumentHistory, document = history.present): DocumentHistory {
  let savedRevisionId: string | null = null;
  for (const revision of history.revisions.values()) {
    if (revision.document === document) savedRevisionId = revision.id;
  }
  if (document === history.present) savedRevisionId = history.presentRevisionId;
  return { ...history, saved: document, savedRevisionId };
}

export function isDirty(history: DocumentHistory, preview = history.present): boolean {
  return history.saved !== preview;
}

export function listRevisions(history: DocumentHistory): RevisionSummary[] {
  return Array.from(history.revisions.values(), (revision) => ({
    id: revision.id,
    parentId: revision.parentId,
    isCurrent: revision.id === history.presentRevisionId,
    isSaved: revision.id === history.savedRevisionId,
  }));
}

export function getRevision(history: DocumentHistory, id: string): DocumentRevision | undefined {
  const revision = history.revisions.get(id);
  return revision ? { ...revision, document: structuredClone(revision.document) } : undefined;
}
