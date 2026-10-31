import { Result } from "@praha/byethrow";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { drawingGeometry, frameOrigin, pointOnCanvas } from "../../document/drawing";
import {
  deleteNode,
  duplicateNode,
  findNode,
  setNodeGeometry,
  setNodeStyle,
  setTextContent,
  setTextStyle,
} from "../../document/commands";
import type { DocumentNode } from "../../document/types";
import { screenDeltaToDocument } from "../../document/viewport";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { LayersPanel } from "./components/LayersPanel";
import { useEditorDocument } from "./hooks/useEditorDocument";
import type { DragState, DrawingState, DrawTool, PanState } from "./types";
import "../../App.css";

function EditorPage() {
  const {
    history, design, designRef, selectedId, setSelectedId, selected,
    error, setError, filePath, isBusy, isDirty, agentApi,
    recordDocument, applyDocument, previewDocument, finishPreview,
    stepHistory: stepDocumentHistory, openFile, saveFile,
  } = useEditorDocument();
  const drag = useRef<DragState | null>(null);
  const pan = useRef<PanState | null>(null);
  const spacePressed = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [drawTool, setDrawTool] = useState<DrawTool>("select");
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const drawingRef = useRef<DrawingState | null>(null);

  function addRectangle() {
    const index = designRef.current.children.length;
    const parentId = selected?.type === "frame" ? selected.id : undefined;
    const result = agentApi.add({
      type: "rectangle",
      parentId,
      x: parentId ? 24 : 80 + (index % 8) * 28,
      y: parentId ? 50 : 80 + (index % 8) * 28,
      width: 184,
      height: 112,
    });
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setSelectedId(result.value.id);
  }

  function addEllipse() {
    const index = designRef.current.children.length;
    const parentId = selected?.type === "frame" ? selected.id : undefined;
    const result = agentApi.add({
      type: "ellipse", parentId,
      x: parentId ? 24 : 80 + (index % 8) * 28,
      y: parentId ? 50 : 80 + (index % 8) * 28,
      width: 112, height: 112,
    });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
  }

  function addFrame() {
    const index = designRef.current.children.length;
    const result = agentApi.add({
      type: "frame", x: 80 + (index % 6) * 28, y: 80 + (index % 6) * 28,
      width: 360, height: 260,
    });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
  }

  function addText() {
    const index = designRef.current.children.length;
    const parentId = selected?.type === "frame" ? selected.id : undefined;
    const result = agentApi.add({
      type: "text", parentId, content: "テキスト",
      x: parentId ? 24 : 80 + (index % 8) * 28,
      y: parentId ? 50 : 80 + (index % 8) * 28,
      width: 220, height: 48,
    });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const result = deleteNode(designRef.current, selectedId);
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    recordDocument(result.value);
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedId) return;
    const result = duplicateNode(designRef.current, selectedId);
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    recordDocument(result.value.document);
    setSelectedId(result.value.node.id);
  }

  function startDrag(
    event: PointerEvent<HTMLElement>,
    node: DocumentNode,
  ) {
    if (event.button !== 0 || drag.current || spacePressed.current || drawTool !== "select") return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      mode: "move",
      id: node.id,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      zoom,
    };
    setSelectedId(node.id);
  }

  function startResize(event: PointerEvent<HTMLSpanElement>, node: DocumentNode) {
    if (event.button !== 0 || drag.current || spacePressed.current || drawTool !== "select") return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
    drag.current = {
      mode: "resize", id: node.id, pointerId: event.pointerId,
      clientX: event.clientX, clientY: event.clientY,
      x: node.x, y: node.y, width: node.width, height: node.height, zoom,
    };
    setSelectedId(node.id);
  }

  function continueDrag(event: PointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = screenDeltaToDocument(event.clientX - active.clientX, active.zoom);
    const dy = screenDeltaToDocument(event.clientY - active.clientY, active.zoom);
    const geometry = active.mode === "resize"
      ? { x: active.x, y: active.y, width: Math.max(1, active.width + dx), height: Math.max(1, active.height + dy) }
      : { x: active.x + dx, y: active.y + dy, width: active.width, height: active.height };
    const current = findNode(designRef.current, active.id);
    if (current && current.x === geometry.x && current.y === geometry.y && current.width === geometry.width && current.height === geometry.height) return;
    const moved = setNodeGeometry(designRef.current, active.id, geometry);
    if (Result.isFailure(moved)) {
      setError(moved.error.message);
      return;
    }
    previewDocument(moved.value);
  }

  function finishDrag(pointerId: number) {
    const active = drag.current;
    if (!active || active.pointerId !== pointerId) return;
    drag.current = null;
    const final = findNode(designRef.current, active.id);
    finishPreview(!!final && (final.x !== active.x || final.y !== active.y || final.width !== active.width || final.height !== active.height));
  }

  function stepHistory(direction: "undo" | "redo") {
    if (drag.current) return;
    stepDocumentHistory(direction);
  }

  function startPan(event: PointerEvent<HTMLElement>) {
    if (drag.current || pan.current || !(event.button === 1 || spacePressed.current)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pan.current = {
      pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft, scrollTop: event.currentTarget.scrollTop,
    };
  }

  function continuePan(event: PointerEvent<HTMLElement>) {
    const active = pan.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.currentTarget.scrollLeft = active.scrollLeft - (event.clientX - active.clientX);
    event.currentTarget.scrollTop = active.scrollTop - (event.clientY - active.clientY);
  }

  function finishPan(pointerId: number) {
    if (pan.current?.pointerId === pointerId) pan.current = null;
  }

  function beginDrawing(event: PointerEvent<HTMLDivElement>) {
    if (drawTool === "select" || event.button !== 0 || spacePressed.current || pan.current || drawingRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const frameId = event.target instanceof Element ? event.target.closest("[data-frame-id]")?.getAttribute("data-frame-id") ?? null : null;
    const origin = frameId ? frameOrigin(designRef.current, frameId) : { x: 0, y: 0 };
    if (!origin) return;
    const start = pointOnCanvas(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), zoom);
    const next = { pointerId: event.pointerId, tool: drawTool, start, end: start, parentId: frameId, parentOrigin: origin };
    drawingRef.current = next;
    setDrawing(next);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateDrawing(event: PointerEvent<HTMLDivElement>) {
    const active = drawingRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const next = { ...active, end: pointOnCanvas(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), zoom) };
    drawingRef.current = next;
    setDrawing(next);
  }

  function cancelDrawing(pointerId?: number) {
    if (!drawingRef.current || (pointerId !== undefined && drawingRef.current.pointerId !== pointerId)) return;
    drawingRef.current = null;
    setDrawing(null);
  }

  function finishDrawing(event: PointerEvent<HTMLDivElement>) {
    const active = drawingRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const end = pointOnCanvas(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), zoom);
    const geometry = drawingGeometry(active.start, end, active.parentOrigin);
    cancelDrawing(event.pointerId);
    if (geometry.width < 4 || geometry.height < 4) return;
    const result = agentApi.add({ type: active.tool, parentId: active.parentId ?? undefined, ...geometry });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
    setDrawTool("select");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && drawingRef.current) {
        cancelDrawing();
        setDrawTool("select");
        event.preventDefault();
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editing = target?.closest("input, textarea, [contenteditable]");
      const toolbarButton = target?.closest("button:not(.canvas-node)");
      if (event.code === "Space" && !editing && !toolbarButton) {
        spacePressed.current = true;
        event.preventDefault();
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== "z") return;
      if (editing) return;
      event.preventDefault();
      stepHistory(event.shiftKey ? "redo" : "undo");
    }
    function onKeyUp(event: KeyboardEvent) { if (event.code === "Space") spacePressed.current = false; }
    function onBlur() { spacePressed.current = false; }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  });

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
        <button className="file-button" type="button" onClick={addEllipse}>楕円を追加</button>
        <div className="drawing-tools" aria-label="描画ツール">
          <button type="button" aria-pressed={drawTool === "rectangle"} onClick={() => setDrawTool(drawTool === "rectangle" ? "select" : "rectangle")}>矩形を描く</button>
          <button type="button" aria-pressed={drawTool === "ellipse"} onClick={() => setDrawTool(drawTool === "ellipse" ? "select" : "ellipse")}>楕円を描く</button>
        </div>
        <button className="file-button" type="button" onClick={addFrame}>フレームを追加</button>
        <button className="file-button" type="button" onClick={addText}>テキストを追加</button>
      </header>

      <div className="workspace">
        <LayersPanel nodes={design.children} selectedId={selectedId} onSelect={setSelectedId} />

        <Canvas
          design={design} selectedId={selectedId} zoom={zoom} setZoom={setZoom}
          drawTool={drawTool} drawing={drawing}
          onNodePointerDown={startDrag} onResizePointerDown={startResize}
          onNodePointerMove={continueDrag} onNodePointerUp={finishDrag}
          onPanPointerDown={startPan} onPanPointerMove={continuePan} onPanPointerUp={finishPan}
          onWorldPointerDown={(event) => {
            if (drawTool !== "select") beginDrawing(event);
            else if (event.target === event.currentTarget && !spacePressed.current && event.button === 0) setSelectedId(null);
          }}
          onWorldPointerMove={updateDrawing} onWorldPointerUp={finishDrawing}
          onWorldPointerCancel={cancelDrawing}
        />

        <Inspector
          selected={selected}
          onRename={(name) => {
            if (!selected) return;
            const result = agentApi.rename(selected.id, name);
            if (Result.isFailure(result)) setError(result.error.message);
          }}
          onGeometry={(geometry) => { if (selected) applyDocument(setNodeGeometry(designRef.current, selected.id, geometry)); }}
          onTextContent={(content) => { if (selected) applyDocument(setTextContent(designRef.current, selected.id, content)); }}
          onTextStyle={(style) => { if (selected) applyDocument(setTextStyle(designRef.current, selected.id, style)); }}
          onShapeStyle={(style) => { if (selected) applyDocument(setNodeStyle(designRef.current, selected.id, style)); }}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
        />
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

export default EditorPage;
