import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";
import { createAgentApi } from "../../../document/agent";
import { createDocument, findNode } from "../../../document/commands";
import { commit, createHistory, isDirty as isDocumentDirty, markSaved, redo, undo } from "../../../document/history";
import { openDocumentFile, saveDocumentFile } from "../../../document/persistence";
import type { Document } from "../../../document/types";
import { documentFiles } from "../../../ipc/documentFiles";
import { useMcpBridge } from "./useMcpBridge";

export function useEditorDocument() {
  const [history, setHistory] = useState(() => createHistory(createDocument()));
  const historyRef = useRef(history);
  const [design, setDesign] = useState<Document>(history.present);
  const designRef = useRef(design);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const revision = useRef(0);
  const fileOperation = useRef(false);
  const selected = selectedId ? findNode(design, selectedId) : undefined;
  const isDirty = isDocumentDirty(history, design);

  function recordDocument(document: Document) {
    const next = commit(historyRef.current, document);
    historyRef.current = next;
    setHistory(next);
    designRef.current = document;
    setDesign(document);
    revision.current += 1;
    setError(null);
  }

  const agentApi = createAgentApi({
    getDocument: () => designRef.current,
    getSelectedId: () => selectedId,
    apply: recordDocument,
  });
  useMcpBridge(agentApi, setError);

  function applyDocument(result: Result.Result<Document, Error>) {
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    recordDocument(result.value);
  }

  function previewDocument(document: Document) {
    designRef.current = document;
    setDesign(document);
    revision.current += 1;
    setError(null);
  }

  function finishPreview(changed: boolean) {
    if (changed) {
      const next = commit(historyRef.current, designRef.current);
      historyRef.current = next;
      setHistory(next);
    } else {
      designRef.current = historyRef.current.present;
      setDesign(historyRef.current.present);
    }
  }

  function stepHistory(direction: "undo" | "redo") {
    const next = direction === "undo" ? undo(historyRef.current) : redo(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    designRef.current = next.present;
    setDesign(next.present);
    if (selectedId && !findNode(next.present, selectedId)) setSelectedId(null);
    revision.current += 1;
    setError(null);
  }

  async function openFile() {
    if (fileOperation.current) return;
    if (isDocumentDirty(historyRef.current, designRef.current) && designRef.current.children.length > 0 && !window.confirm("未保存の変更があります。別のドキュメントを開きますか？")) return;
    fileOperation.current = true;
    setIsBusy(true);
    const startedAt = revision.current;
    const result = await openDocumentFile(documentFiles);
    fileOperation.current = false;
    setIsBusy(false);
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    if (result.value === null) return;
    if (revision.current !== startedAt) { setError("読み込み中に編集されたため、現在のドキュメントを維持しました"); return; }
    const next = createHistory(result.value.document, true);
    historyRef.current = next;
    setHistory(next);
    designRef.current = result.value.document;
    setDesign(result.value.document);
    setFilePath(result.value.path);
    setSelectedId(null);
    revision.current += 1;
    setError(null);
  }

  async function saveFile() {
    if (fileOperation.current) return;
    fileOperation.current = true;
    setIsBusy(true);
    const snapshot = designRef.current;
    const result = await saveDocumentFile(documentFiles, snapshot, filePath);
    fileOperation.current = false;
    setIsBusy(false);
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    if (result.value === null) return;
    setFilePath(result.value);
    const next = markSaved(historyRef.current, snapshot);
    historyRef.current = next;
    setHistory(next);
    setError(null);
  }

  return {
    history, design, designRef, selectedId, setSelectedId, selected,
    error, setError, filePath, isBusy, isDirty, agentApi,
    recordDocument, applyDocument, previewDocument, finishPreview, stepHistory, openFile, saveFile,
  };
}
