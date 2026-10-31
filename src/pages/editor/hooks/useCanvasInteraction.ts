import { Result } from "@praha/byethrow";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { findNode, setNodeGeometry } from "@/document/commands/index.ts";
import { drawingGeometry, frameOrigin, pointOnCanvas } from "@/pages/editor/geometry";
import type { DocumentNode } from "@/document/types";
import { screenDeltaToDocument } from "@/pages/editor/viewport";
import type { DragState, DrawingState, DrawTool, PanState } from "@/pages/editor/types";
import type { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";

export function useCanvasInteraction(session: ReturnType<typeof useEditorDocument>) {
  const {
    designRef, setSelectedId, setError, agentApi,
    previewDocument, finishPreview, stepHistory: stepDocumentHistory,
  } = session;
  const drag = useRef<DragState | null>(null);
  const pan = useRef<PanState | null>(null);
  const spacePressed = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [drawTool, setDrawTool] = useState<DrawTool>("select");
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const drawingRef = useRef<DrawingState | null>(null);

  function startDrag(event: PointerEvent<HTMLElement>, node: DocumentNode) {
    if (event.button !== 0 || drag.current || spacePressed.current || drawTool !== "select") return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      mode: "move", id: node.id, pointerId: event.pointerId,
      clientX: event.clientX, clientY: event.clientY,
      x: node.x, y: node.y, width: node.width, height: node.height, zoom,
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
    if (Result.isFailure(moved)) { setError(moved.error.message); return; }
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
    if (!drag.current) stepDocumentHistory(direction);
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

  function onWorldPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (drawTool !== "select") beginDrawing(event);
    else if (event.target === event.currentTarget && !spacePressed.current && event.button === 0) setSelectedId(null);
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

  return {
    drag, zoom, setZoom, drawTool, setDrawTool, drawing,
    startDrag, startResize, continueDrag, finishDrag, stepHistory,
    startPan, continuePan, finishPan,
    onWorldPointerDown, updateDrawing, finishDrawing, cancelDrawing,
  };
}
