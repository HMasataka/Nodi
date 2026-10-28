import { Result } from "@praha/byethrow";
import { useRef, useState, type PointerEvent } from "react";
import {
  addNode,
  createDocument,
  findNode,
  moveNode,
  renameNode,
} from "./document/commands";
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
  const [design, setDesign] = useState<Document>(createDocument);
  const designRef = useRef(design);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(true);
  const dirtyRef = useRef(true);
  const [isBusy, setIsBusy] = useState(false);
  const revision = useRef(0);
  const fileOperation = useRef(false);
  const drag = useRef<DragState | null>(null);
  const selected = selectedId ? findNode(design, selectedId) : undefined;

  function applyDocument(result: Result.Result<Document, Error>) {
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    designRef.current = result.value;
    setDesign(result.value);
    revision.current += 1;
    dirtyRef.current = true;
    setIsDirty(true);
    setError(null);
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
    designRef.current = result.value.document;
    setDesign(result.value.document);
    revision.current += 1;
    dirtyRef.current = true;
    setIsDirty(true);
    setSelectedId(result.value.node.id);
    setError(null);
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
    applyDocument(
      moveNode(
        designRef.current,
        active.id,
        x,
        y,
      ),
    );
  }

  function stopDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  async function openFile() {
    if (fileOperation.current) return;
    if (dirtyRef.current && designRef.current.children.length > 0 && !window.confirm("未保存の変更があります。別のドキュメントを開きますか？")) return;
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
    designRef.current = result.value.document;
    setDesign(result.value.document);
    setFilePath(result.value.path);
    setSelectedId(null);
    dirtyRef.current = false;
    setIsDirty(false);
    revision.current += 1;
    setError(null);
  }

  async function saveFile() {
    if (fileOperation.current) return;
    fileOperation.current = true;
    setIsBusy(true);
    const startedAt = revision.current;
    const result = await saveDocumentFile(documentFiles, designRef.current, filePath);
    fileOperation.current = false;
    setIsBusy(false);
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    if (result.value === null) return;
    setFilePath(result.value);
    dirtyRef.current = revision.current !== startedAt;
    setIsDirty(dirtyRef.current);
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
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
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
                key={selected.id}
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
