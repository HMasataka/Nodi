import { isTauri } from "@tauri-apps/api/core";
import { Result } from "@praha/byethrow";
import { useEffect, useRef, useState } from "react";

import type { Document } from "@/document/types";
import { documentFiles } from "@/ipc/documentFiles";
import { recoveryFiles } from "@/ipc/recoveryFiles";
import type { RecoveryStatus } from "@/pages/editor/types";
import { useMcpBridge } from "@/pages/editor/hooks/useMcpBridge";
import { clearRecoveryDraft, readRecoveryDraft, writeRecoveryDraft } from "@/persistence/recovery";
import { commit, createHistory, isDirty as isDocumentDirty, markSaved, redo, undo } from "@/document/history";
import { createAgentApi, type FocusedViewport } from "@/agent/api";
import { createDocument, findNode } from "@/document/commands/index.ts";
import { openDocumentFile, saveDocumentFile } from "@/persistence/documentFile";

export function useEditorDocument() {
  const [history, setHistory] = useState(() => createHistory(createDocument(), true));
  const historyRef = useRef(history);
  const [design, setDesign] = useState<Document>(history.present);
  const designRef = useRef(design);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  function setSelectedId(id: string | null) { setSelectedIds(id ? [id] : []); }
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [documentSession, setDocumentSession] = useState(0);
  const revision = useRef(0);
  const previewActive = useRef(false);
  const fileOperation = useRef(false);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>(() => isTauri() ? { kind: "checking" } : { kind: "none" });
  const recoveryQueue = useRef(Promise.resolve());
  const focusElementRef = useRef<(id: string) => Result.Result<FocusedViewport, Error>>(() => Result.fail(new Error("キャンバスを表示できません")));
  const selected = selectedId ? findNode(design, selectedId) : undefined;
  const isDirty = isDocumentDirty(history, design);

  function ensureEditable(): Result.Result<void, Error> {
    return previewActive.current ? Result.fail(new Error("ドラッグ中は他の編集やファイル操作を実行できません")) : Result.succeed();
  }

  function beginPreview() { previewActive.current = true; }

  function queueRecovery(action: () => Promise<Result.Result<void, Error>>) {
    recoveryQueue.current = recoveryQueue.current.then(async () => {
      const result = await action();
      if (Result.isFailure(result)) setError(result.error.message);
    }).catch((error: unknown) => { setError(`復元データの処理に失敗しました: ${String(error)}`); });
  }

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void readRecoveryDraft(recoveryFiles).then((result) => {
      if (!active) return;
      if (Result.isFailure(result)) setRecoveryStatus({ kind: "error", message: result.error.message });
      else setRecoveryStatus(result.value ? { kind: "available", draft: result.value } : { kind: "none" });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isTauri() || recoveryStatus.kind !== "none" || history.present !== design) return;
    if (isDocumentDirty(history, design)) {
      queueRecovery(() => writeRecoveryDraft(recoveryFiles, { document: design, sourcePath: filePath }));
    } else {
      queueRecovery(() => clearRecoveryDraft(recoveryFiles));
    }
  }, [history, design, filePath, recoveryStatus.kind]);

  function restoreRecovery() {
    if (recoveryStatus.kind !== "available") return;
    const next = createHistory(recoveryStatus.draft.document);
    historyRef.current = next;
    setHistory(next);
    designRef.current = next.present;
    setDesign(next.present);
    setFilePath(null);
    setDocumentSession((value) => value + 1);
    setSelectedIds([]);
    revision.current += 1;
    setRecoveryStatus({ kind: "none" });
    setError(null);
  }

  async function discardRecovery() {
    const result = await clearRecoveryDraft(recoveryFiles);
    if (Result.isFailure(result)) { setRecoveryStatus({ kind: "error", message: result.error.message }); return; }
    setRecoveryStatus({ kind: "none" });
    setError(null);
  }

  function recordDocument(document: Document) {
    const editable = ensureEditable();
    if (Result.isFailure(editable)) { setError(editable.error.message); return; }
    if (document === designRef.current) { setError(null); return; }
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
    getHistory: () => historyRef.current,
    getSelectedId: () => selectedId,
    apply: recordDocument,
    canEdit: ensureEditable,
    focus: (id) => focusElementRef.current(id),
  });
  useMcpBridge(agentApi, setError, recoveryStatus.kind === "none");

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
    previewActive.current = false;
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
    setSelectedIds((ids) => ids.filter((id) => !!findNode(next.present, id)));
    revision.current += 1;
    setError(null);
  }

  async function openFile() {
    const editable = ensureEditable();
    if (Result.isFailure(editable)) { setError(editable.error.message); return; }
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
    setDocumentSession((value) => value + 1);
    setSelectedIds([]);
    revision.current += 1;
    setError(null);
    queueRecovery(() => clearRecoveryDraft(recoveryFiles));
  }

  async function saveFile() {
    const editable = ensureEditable();
    if (Result.isFailure(editable)) { setError(editable.error.message); return; }
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
    const current = designRef.current;
    queueRecovery(() => isDocumentDirty(next, current)
      ? writeRecoveryDraft(recoveryFiles, { document: current, sourcePath: result.value })
      : clearRecoveryDraft(recoveryFiles));
  }

  return {
    history, design, designRef, documentSession, selectedId, selectedIds, setSelectedId, setSelectedIds, selected,
    error, setError, filePath, isBusy, isDirty, agentApi, recoveryStatus, restoreRecovery, discardRecovery, focusElementRef,
    recordDocument, applyDocument, beginPreview, previewDocument, finishPreview, stepHistory, openFile, saveFile,
  };
}
