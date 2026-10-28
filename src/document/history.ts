import type { Document } from "./types.ts";

export interface DocumentHistory {
  past: Document[];
  present: Document;
  future: Document[];
  saved: Document | null;
}

export function createHistory(document: Document, saved = false): DocumentHistory {
  return { past: [], present: document, future: [], saved: saved ? document : null };
}

export function commit(history: DocumentHistory, document: Document): DocumentHistory {
  if (document === history.present) return history;
  return {
    ...history,
    past: [...history.past, history.present],
    present: document,
    future: [],
  };
}

export function undo(history: DocumentHistory): DocumentHistory {
  if (history.past.length === 0) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}

export function redo(history: DocumentHistory): DocumentHistory {
  if (history.future.length === 0) return history;
  return {
    ...history,
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}

export function markSaved(history: DocumentHistory, document = history.present): DocumentHistory {
  return { ...history, saved: document };
}

export function isDirty(history: DocumentHistory, preview = history.present): boolean {
  return history.saved !== preview;
}
