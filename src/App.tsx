import { Result } from "@praha/byethrow";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  addNode,
  createDocument,
  findNode,
  moveNode,
  renameNode,
} from "./document/commands";
import { commit, createHistory, isDirty as isDocumentDirty, markSaved, redo, undo } from "./document/history";
import { openDocumentFile, saveDocumentFile } from "./document/persistence";
import type { Document, DocumentNode } from "./document/types";
import { documentFiles } from "./ipc/documentFiles";
import "./App.css";

interface DragState {
  id: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
}

function NameEditor({
  node,
  onRename,
}: {
  node: DocumentNode;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(node.name);

  return (
    <input
      id="node-name"
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        if (draft !== node.name) onRename(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      spellCheck={false}
    />
  );
}

function App() {
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
  const drag = useRef<DragState | null>(null);
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

  function applyDocument(result: Result.Result<Document, Error>) {
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    recordDocument(result.value);
  }

  function addRectangle() {
    const index = designRef.current.children.length;
    const result = addNode(designRef.current, {
      type: "rectangle",
      x: 80 + (index % 8) * 28,
      y: 80 + (index % 8) * 28,
      width: 184,
      height: 112,
    });
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    recordDocument(result.value.document);
    setSelectedId(result.value.node.id);
  }

  function startDrag(
    event: PointerEvent<HTMLButtonElement>,
    node: DocumentNode,
  ) {
    if (event.button !== 0 || drag.current) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: node.id,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: node.x,
      y: node.y,
    };
    setSelectedId(node.id);
  }

  function continueDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const x = active.x + event.clientX - active.clientX;
    const y = active.y + event.clientY - active.clientY;
    const current = findNode(designRef.current, active.id);
    if (current?.x === x && current.y === y) return;
    const moved = moveNode(designRef.current, active.id, x, y);
    if (Result.isFailure(moved)) {
      setError(moved.error.message);
      return;
    }
    designRef.current = moved.value;
    setDesign(moved.value);
    revision.current += 1;
    setError(null);
  }

  function finishDrag(pointerId: number) {
    const active = drag.current;
    if (!active || active.pointerId !== pointerId) return;
    drag.current = null;
    const final = findNode(designRef.current, active.id);
    if (final && (final.x !== active.x || final.y !== active.y)) {
      const next = commit(historyRef.current, designRef.current);
      historyRef.current = next;
      setHistory(next);
    } else {
      designRef.current = historyRef.current.present;
      setDesign(historyRef.current.present);
    }
  }

  function stepHistory(direction: "undo" | "redo") {
    if (drag.current) return;
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== "z") return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      stepHistory(event.shiftKey ? "redo" : "undo");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function openFile() {
    if (fileOperation.current) return;
    if (isDocumentDirty(historyRef.current, designRef.current) && designRef.current.children.length > 0 && !window.confirm("未保存の変更があります。別のドキュメントを開きますか？")) return;
    fileOperation.current = true;
    setIsBusy(true);
    const startedAt = revision.current;
    const result = await openDocumentFile(documentFiles);
    fileOperation.current = false;
    setIsBusy(false);
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    if (result.value === null) return;
    if (revision.current !== startedAt) {
      setError("読み込み中に編集されたため、現在のドキュメントを維持しました");
      return;
    }
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
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    if (result.value === null) return;
    setFilePath(result.value);
    const next = markSaved(historyRef.current, snapshot);
    historyRef.current = next;
    setHistory(next);
    setError(null);
  }

  const fileName = filePath?.split(/[\\/]/).pop() ?? "無題のドキュメント";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>Nodi</span>
          <span className="brand-divider" />{" "}
          <span className="document-title" title={filePath ?? undefined}>{fileName}</span>
        </div>
        <span className="topbar-note">DOCUMENT / 001</span>
        <div className="history-controls" aria-label="編集履歴">
          <button className="file-button" type="button" onClick={() => stepHistory("undo")} disabled={history.past.length === 0 || !!drag.current} title="元に戻す (⌘/Ctrl+Z)">元に戻す</button>
          <button className="file-button" type="button" onClick={() => stepHistory("redo")} disabled={history.future.length === 0 || !!drag.current} title="やり直す (⌘/Ctrl+Shift+Z)">やり直す</button>
        </div>
        <button className="file-button" type="button" onClick={openFile} disabled={isBusy}>開く</button>
        <button className="file-button" type="button" onClick={saveFile} disabled={isBusy}>保存</button>
        <button className="add-button" type="button" onClick={addRectangle}>
          <span aria-hidden="true">＋</span> 矩形を追加
        </button>
      </header>

      <div className="workspace">
        <aside className="sidebar layers" aria-label="レイヤー">
          <div className="panel-heading">
            <h2>レイヤー</h2>
            <span>{design.children.length.toString().padStart(2, "0")}</span>
          </div>
          {design.children.length === 0 ? (
            <p className="panel-empty">
              まだ要素がありません。
              <br />
              矩形を追加して始めましょう。
            </p>
          ) : (
            <div className="layer-list">
              {design.children.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={`layer-row${selectedId === node.id ? " is-selected" : ""}`}
                  aria-pressed={selectedId === node.id}
                  onClick={() => setSelectedId(node.id)}
                >
                  <span className="layer-icon" aria-hidden="true" />
                  <span className="layer-name">{node.name}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="canvas-viewport" aria-label="キャンバス">
          <div
            className="canvas-surface"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            {design.children.length === 0 && (
              <div className="canvas-hint" aria-hidden="true">
                <span className="hint-symbol">＋</span>
                <span>ここから、かたちをつくる。</span>
              </div>
            )}
            {design.children.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`canvas-node${selectedId === node.id ? " is-selected" : ""}`}
                aria-label={node.name}
                aria-pressed={selectedId === node.id}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                }}
                onPointerDown={(event) => startDrag(event, node)}
                onPointerMove={continueDrag}
                onPointerUp={(event) => finishDrag(event.pointerId)}
                onPointerCancel={(event) => finishDrag(event.pointerId)}
                onLostPointerCapture={(event) => finishDrag(event.pointerId)}
              >
                <span className="node-label">{node.name}</span>
              </button>
            ))}
          </div>
          <div className="canvas-scale">
            100% <span>・</span> キャンバス
          </div>
        </section>

        <aside className="sidebar inspector" aria-label="プロパティ">
          <div className="panel-heading">
            <h2>プロパティ</h2>
            <span>01</span>
          </div>
          {selected ? (
            <div className="properties">
              <div className="selection-type">
                <span className="layer-icon" aria-hidden="true" />{" "}
                {selected.type === "rectangle" ? "矩形" : "フレーム"}
              </div>
              <label className="field-label" htmlFor="node-name">
                名前
              </label>
              <NameEditor
                key={`${selected.id}:${selected.name}`}
                node={selected}
                onRename={(name) =>
                  applyDocument(
                    renameNode(designRef.current, selected.id, name),
                  )
                }
              />
              <div className="property-divider" />
              <div className="field-label">位置</div>
              <div className="measure-row">
                <span>X&nbsp; {Math.round(selected.x)}</span>
                <span>Y&nbsp; {Math.round(selected.y)}</span>
              </div>
              <div className="field-label">サイズ</div>
              <div className="measure-row">
                <span>W&nbsp; {selected.width}</span>
                <span>H&nbsp; {selected.height}</span>
              </div>
              <div className="property-divider" />
              <div className="field-label">要素 ID</div>
              <code className="node-id">{selected.id}</code>
              <p className="property-help">
                名前は変更できます。ID
                はこの要素を正確に指すために変わりません。
              </p>
            </div>
          ) : (
            <p className="panel-empty">
              キャンバス上の要素を選択すると、ここに詳細が表示されます。
            </p>
          )}
        </aside>
      </div>

      <footer className="statusbar">
        <span>
          <span className={`status-dot${isDirty ? " is-dirty" : ""}`} /> {isDirty ? "未保存の変更" : "保存済み"}
        </span>
        <span>
          {selected
            ? `${selected.name} · ${selected.id}`
            : "要素が選択されていません"}
        </span>
      </footer>
      {error && (
        <div className="error-toast" role="alert">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}

export default App;
