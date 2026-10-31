import { Result } from "@praha/byethrow";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createAgentApi } from "./document/agent";
import { dispatchAgentRequest } from "./document/agentBridge";
import { drawingGeometry, frameOrigin, pointOnCanvas, type Point } from "./document/drawing";
import {
  createDocument,
  deleteNode,
  duplicateNode,
  findNode,
  setNodeGeometry,
  setNodeStyle,
  setTextContent,
  setTextStyle,
} from "./document/commands";
import { commit, createHistory, isDirty as isDocumentDirty, markSaved, redo, undo } from "./document/history";
import { openDocumentFile, saveDocumentFile } from "./document/persistence";
import type { Document, DocumentNode, EllipseNode, Geometry, RectangleNode, RectangleStyle, TextNode, TextStyle } from "./document/types";
import { clampZoom, screenDeltaToDocument } from "./document/viewport";
import { documentFiles } from "./ipc/documentFiles";
import "./App.css";

interface DragState {
  mode: "move" | "resize";
  id: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

interface PanState { pointerId: number; clientX: number; clientY: number; scrollLeft: number; scrollTop: number }
type DrawTool = "select" | "rectangle" | "ellipse";
interface DrawingState { pointerId: number; tool: Exclude<DrawTool, "select">; start: Point; end: Point; parentId: string | null; parentOrigin: Point }

function GeometryEditor({ node, onChange }: { node: DocumentNode; onChange: (geometry: Geometry) => void }) {
  const [draft, setDraft] = useState<Record<keyof Geometry, string>>({
    x: String(node.x), y: String(node.y), width: String(node.width), height: String(node.height),
  });
  const fields: { key: keyof Geometry; label: string }[] = [
    { key: "x", label: "X" }, { key: "y", label: "Y" },
    { key: "width", label: "W" }, { key: "height", label: "H" },
  ];
  return (
    <div className="geometry-fields">
      {fields.map(({ key, label }) => (
        <label key={key} className="geometry-field">
          <span>{label}</span>
          <input
            type="number"
            step="any"
            value={draft[key]}
            onChange={(event) => setDraft({ ...draft, [key]: event.currentTarget.value })}
            onBlur={() => {
              if (draft[key] !== String(node[key])) {
                onChange({ ...node, [key]: draft[key].trim() === "" ? NaN : Number(draft[key]) });
              }
            }}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          />
        </label>
      ))}
    </div>
  );
}

function StyleEditor({ node, onChange }: { node: RectangleNode | EllipseNode; onChange: (style: Partial<RectangleStyle>) => void }) {
  const [fill, setFill] = useState(node.fill);
  const [stroke, setStroke] = useState(node.stroke);
  const [strokeWidth, setStrokeWidth] = useState(String(node.strokeWidth));
  const [cornerRadius, setCornerRadius] = useState(node.type === "rectangle" ? String(node.cornerRadius) : "");
  return (
    <div className="style-fields">
      <label>塗り <input type="color" value={fill} onChange={(event) => setFill(event.currentTarget.value)} onBlur={() => { if (fill !== node.fill) onChange({ fill }); }} /></label>
      <label>線 <input type="color" value={stroke} onChange={(event) => setStroke(event.currentTarget.value)} onBlur={() => { if (stroke !== node.stroke) onChange({ stroke }); }} /></label>
      <label>線幅 <input type="number" min="0" step="any" value={strokeWidth} onChange={(event) => setStrokeWidth(event.currentTarget.value)} onBlur={() => { if (strokeWidth !== String(node.strokeWidth)) onChange({ strokeWidth: strokeWidth.trim() === "" ? NaN : Number(strokeWidth) }); }} /></label>
      {node.type === "rectangle" && <label>角丸 <input type="number" min="0" step="any" value={cornerRadius} onChange={(event) => setCornerRadius(event.currentTarget.value)} onBlur={() => { if (cornerRadius !== String(node.cornerRadius)) onChange({ cornerRadius: cornerRadius.trim() === "" ? NaN : Number(cornerRadius) }); }} /></label>}
    </div>
  );
}

function ContentEditor({ node, onChange }: { node: TextNode; onChange: (content: string) => void }) {
  const [draft, setDraft] = useState(node.content);
  return (
    <textarea
      className="content-editor" value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => { if (draft !== node.content) onChange(draft); }}
      aria-label="テキスト本文"
    />
  );
}

function TextStyleEditor({ node, onChange }: { node: TextNode; onChange: (style: Partial<TextStyle>) => void }) {
  const [fontSize, setFontSize] = useState(String(node.fontSize));
  const [color, setColor] = useState(node.color);
  return (
    <div className="text-style-fields">
      <label>文字サイズ
        <input type="number" min="1" step="any" value={fontSize}
          onChange={(event) => setFontSize(event.currentTarget.value)}
          onBlur={() => { if (fontSize !== String(node.fontSize)) onChange({ fontSize: fontSize.trim() === "" ? NaN : Number(fontSize) }); }} />
      </label>
      <label>文字色
        <input type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)}
          onBlur={() => { if (color !== node.color) onChange({ color }); }} />
      </label>
      <label>揃え
        <select value={node.textAlign} onChange={(event) => onChange({ textAlign: event.currentTarget.value as TextStyle["textAlign"] })}>
          <option value="left">左</option><option value="center">中央</option><option value="right">右</option>
        </select>
      </label>
      <p>枠の幅で折り返し、高さを超えた本文は隠れます。枠の高さは「位置・サイズ」で変更できます。</p>
    </div>
  );
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
  const pan = useRef<PanState | null>(null);
  const spacePressed = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [drawTool, setDrawTool] = useState<DrawTool>("select");
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const drawingRef = useRef<DrawingState | null>(null);
  const selected = selectedId ? findNode(design, selectedId) : undefined;
  const isDirty = isDocumentDirty(history, design);
  const layerCount = (function count(nodes: DocumentNode[]): number {
    return nodes.reduce((total, node) => total + 1 + (node.type === "frame" ? count(node.children) : 0), 0);
  })(design.children);

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
  const agentApiRef = useRef(agentApi);
  agentApiRef.current = agentApi;

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    void listen<{ id: string; method: string; args: unknown }>("nodi:mcp-request", (event) => {
      const { id, method, args } = event.payload;
      const response = dispatchAgentRequest(agentApiRef.current, method, args);
      void invoke("resolve_mcp_request", { id, response }).catch((error: unknown) => {
        setError(`MCP 応答に失敗しました: ${String(error)}`);
      });
    }).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    }).catch((error: unknown) => setError(`MCP 接続に失敗しました: ${String(error)}`));
    return () => { active = false; unlisten?.(); };
  }, []);

  function applyDocument(result: Result.Result<Document, Error>) {
    if (Result.isFailure(result)) {
      setError(result.error.message);
      return;
    }
    recordDocument(result.value);
  }

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
    if (final && (final.x !== active.x || final.y !== active.y || final.width !== active.width || final.height !== active.height)) {
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

  function renderLayer(node: DocumentNode, depth = 0): React.ReactNode {
    return (
      <div key={node.id}>
        <button
          type="button"
          className={`layer-row${selectedId === node.id ? " is-selected" : ""}`}
          style={{ paddingLeft: 11 + depth * 18 }}
          aria-pressed={selectedId === node.id}
          onClick={() => setSelectedId(node.id)}
        >
          <span className={`layer-icon${node.type === "ellipse" ? " ellipse-icon" : ""}`} aria-hidden="true">{node.type === "text" ? "T" : ""}</span>
          <span className="layer-name">{node.name}</span>
        </button>
        {node.type === "frame" && node.children.map((child) => renderLayer(child, depth + 1))}
      </div>
    );
  }

  function renderNode(node: DocumentNode): React.ReactNode {
    const style = { left: node.x, top: node.y, width: node.width, height: node.height };
    if (node.type === "frame") return (
      <div
        key={node.id}
        className={`canvas-frame${selectedId === node.id ? " is-selected" : ""}`}
        role="group"
        aria-label={node.name}
        style={style}
        onPointerDown={(event) => { if (event.target === event.currentTarget) startDrag(event, node); }}
        onPointerMove={continueDrag}
        onPointerUp={(event) => finishDrag(event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
        onLostPointerCapture={(event) => finishDrag(event.pointerId)}
      >
        {node.children.map(renderNode)}
        {selectedId === node.id && <span className="resize-handle" aria-hidden="true" onPointerDown={(event) => startResize(event, node)} />}
      </div>
    );
    if (node.type === "text") return (
      <button
        key={node.id} type="button"
        className={`canvas-text${selectedId === node.id ? " is-selected" : ""}`}
        aria-label={node.name} aria-pressed={selectedId === node.id}
        style={{ ...style, fontSize: node.fontSize, color: node.color, textAlign: node.textAlign }}
        onPointerDown={(event) => startDrag(event, node)} onPointerMove={continueDrag}
        onPointerUp={(event) => finishDrag(event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
        onLostPointerCapture={(event) => finishDrag(event.pointerId)}
      >
        {node.content}
        {selectedId === node.id && <span className="resize-handle" aria-hidden="true" onPointerDown={(event) => startResize(event, node)} />}
      </button>
    );
    return (
      <button
        key={node.id} type="button"
        className={`canvas-node${node.type === "ellipse" ? " canvas-ellipse" : ""}${selectedId === node.id ? " is-selected" : ""}`}
        aria-label={node.name} aria-pressed={selectedId === node.id}
        style={{ ...style, background: node.fill, borderColor: node.stroke, borderWidth: node.strokeWidth, borderRadius: node.type === "ellipse" ? "50%" : node.cornerRadius }}
        onPointerDown={(event) => startDrag(event, node)} onPointerMove={continueDrag}
        onPointerUp={(event) => finishDrag(event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
        onLostPointerCapture={(event) => finishDrag(event.pointerId)}
      >
        {selectedId === node.id && <span className="resize-handle" aria-hidden="true" onPointerDown={(event) => startResize(event, node)} />}
      </button>
    );
  }

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
        <aside className="sidebar layers" aria-label="レイヤー">
          <div className="panel-heading">
            <h2>レイヤー</h2>
            <span>{layerCount.toString().padStart(2, "0")}</span>
          </div>
          {design.children.length === 0 ? (
            <p className="panel-empty">
              まだ要素がありません。
              <br />
              矩形を追加して始めましょう。
            </p>
          ) : (
            <div className="layer-list">
              {design.children.map((node) => renderLayer(node))}
            </div>
          )}
        </aside>

        <section
          className="canvas-viewport" aria-label="キャンバス"
          onPointerDown={startPan}
          onPointerMove={continuePan}
          onPointerUp={(event) => finishPan(event.pointerId)}
          onPointerCancel={(event) => finishPan(event.pointerId)}
          onLostPointerCapture={(event) => finishPan(event.pointerId)}
        >
          <div
            className="canvas-surface"
            style={{ width: `max(100%, ${1200 * zoom}px)`, height: `max(100%, ${900 * zoom}px)`, backgroundSize: `${24 * zoom}px ${24 * zoom}px` }}
          >
            <div className={`canvas-world${drawTool !== "select" ? " is-drawing" : ""}`} style={{ transform: `scale(${zoom})` }} onPointerDown={(event) => {
              if (drawTool !== "select") beginDrawing(event);
              else if (event.target === event.currentTarget && !spacePressed.current && event.button === 0) setSelectedId(null);
            }} onPointerMove={updateDrawing} onPointerUp={finishDrawing}
              onPointerCancel={(event) => cancelDrawing(event.pointerId)}
              onLostPointerCapture={(event) => cancelDrawing(event.pointerId)}>
            {design.children.length === 0 && (
              <div className="canvas-hint" aria-hidden="true">
                <span className="hint-symbol">＋</span>
                <span>ここから、かたちをつくる。</span>
              </div>
            )}
            {design.children.map(renderNode)}
            {drawing && (() => {
              const geometry = drawingGeometry(drawing.start, drawing.end, drawing.parentOrigin);
              return <div className={`draw-preview${drawing.tool === "ellipse" ? " is-ellipse" : ""}`}
                style={{ left: geometry.x + drawing.parentOrigin.x, top: geometry.y + drawing.parentOrigin.y, width: geometry.width, height: geometry.height }} />;
            })()}
            </div>
          </div>
          <div className="canvas-scale">
            <button type="button" onClick={() => setZoom((value) => clampZoom(value / 1.25))} aria-label="縮小">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((value) => clampZoom(value * 1.25))} aria-label="拡大">＋</button>
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
                {selected.type === "rectangle" ? "矩形" : selected.type === "ellipse" ? "楕円" : selected.type === "text" ? "テキスト" : "フレーム"}
              </div>
              <label className="field-label" htmlFor="node-name">
                名前
              </label>
              <NameEditor
                key={`${selected.id}:${selected.name}`}
                node={selected}
                onRename={(name) => {
                  const result = agentApi.rename(selected.id, name);
                  if (Result.isFailure(result)) setError(result.error.message);
                }}
              />
              <div className="property-divider" />
              <div className="field-label">位置・サイズ</div>
              <GeometryEditor
                key={`${selected.id}:${selected.x}:${selected.y}:${selected.width}:${selected.height}`}
                node={selected}
                onChange={(geometry) => applyDocument(setNodeGeometry(designRef.current, selected.id, geometry))}
              />
              {selected.type === "text" && (
                <>
                  <div className="field-label">本文</div>
                  <ContentEditor
                    key={`${selected.id}:${selected.content}`}
                    node={selected}
                    onChange={(content) => applyDocument(setTextContent(designRef.current, selected.id, content))}
                  />
                  <div className="field-label">文字の見た目</div>
                  <TextStyleEditor
                    key={`${selected.id}:${selected.fontSize}:${selected.color}:${selected.textAlign}`}
                    node={selected}
                    onChange={(style) => applyDocument(setTextStyle(designRef.current, selected.id, style))}
                  />
                </>
              )}
              {(selected.type === "rectangle" || selected.type === "ellipse") && (
                <>
                  <div className="field-label">スタイル</div>
                  <StyleEditor
                    key={`${selected.id}:${selected.fill}:${selected.stroke}:${selected.strokeWidth}:${selected.type === "rectangle" ? selected.cornerRadius : "ellipse"}`}
                    node={selected}
                    onChange={(style) => applyDocument(setNodeStyle(designRef.current, selected.id, style))}
                  />
                </>
              )}
              <div className="property-divider" />
              <div className="field-label">要素 ID</div>
              <code className="node-id">{selected.id}</code>
              <p className="property-help">
                名前は変更できます。ID
                はこの要素を正確に指すために変わりません。
              </p>
              <div className="node-actions">
                <button type="button" className="file-button" onClick={duplicateSelected}>複製</button>
                <button type="button" className="file-button" onClick={deleteSelected}>削除</button>
              </div>
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
