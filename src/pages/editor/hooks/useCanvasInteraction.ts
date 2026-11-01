import { flushSync } from "react-dom";
import { Result } from "@praha/byethrow";
import { type PointerEvent, useEffect, useRef, useState } from "react";

import type { DocumentNode } from "@/document/types";
import { toggleSelection } from "@/pages/editor/selection";
import type { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import { absoluteGeometry, drawingGeometry, frameOrigin, nodesInBounds, pointOnCanvas } from "@/pages/editor/geometry";
import { canvasExtent, focusViewport, screenDeltaToDocument } from "@/pages/editor/viewport";
import type { DragState, DrawingState, DrawTool, PanState, SelectionRegion } from "@/pages/editor/types";
import { findNode, moveNodes, setNodeGeometry } from "@/document/commands/index.ts";
import { type SnapGuide, snapMove, snapResize } from "@/pages/editor/snapping";

export function useCanvasInteraction(session: ReturnType<typeof useEditorDocument>) {
  const {
    designRef, selectedIds, setSelectedId, setSelectedIds, setError, agentApi,
    previewDocument, finishPreview, stepHistory: stepDocumentHistory, focusElementRef,
  } = session;
  const drag = useRef<DragState | null>(null);
  const pan = useRef<PanState | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const spacePressed = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [drawTool, setDrawTool] = useState<DrawTool>("select");
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const drawingRef = useRef<DrawingState | null>(null);
  const [selection, setSelection] = useState<SelectionRegion | null>(null);
  const selectionRef = useRef<SelectionRegion | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);

  useEffect(() => {
    focusElementRef.current = (id) => {
      const viewport = viewportRef.current;
      const absolute = absoluteGeometry(designRef.current, id);
      if (!absolute) return Result.fail(new Error(`要素が見つかりません: ${id}`));
      if (!viewport || viewport.clientWidth === 0 || viewport.clientHeight === 0) return Result.fail(new Error("キャンバスを表示できません"));
      const extent = canvasExtent(designRef.current);
      const target = focusViewport(absolute, extent, { width: viewport.clientWidth, height: viewport.clientHeight }, zoom);
      flushSync(() => { setZoom(target.zoom); setSelectedId(id); });
      viewport.scrollLeft = target.scrollLeft;
      viewport.scrollTop = target.scrollTop;
      return Result.succeed({
        absolute, zoom: target.zoom, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop,
        screen: {
          x: (extent.originX + absolute.x) * target.zoom - viewport.scrollLeft,
          y: (extent.originY + absolute.y) * target.zoom - viewport.scrollTop,
          width: absolute.width * target.zoom, height: absolute.height * target.zoom,
        },
      });
    };
    return () => { focusElementRef.current = () => Result.fail(new Error("キャンバスを表示できません")); };
  }, [designRef, focusElementRef, setSelectedId, zoom]);

  function startDrag(event: PointerEvent<HTMLElement>, node: DocumentNode) {
    if (event.button !== 0 || drag.current || spacePressed.current || drawTool !== "select") return;
    event.stopPropagation();
    if (event.shiftKey) {
      setSelectedIds((ids) => toggleSelection(ids, node.id));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (selectedIds.length > 1 && selectedIds.includes(node.id)) {
      drag.current = { mode: "group", ids: selectedIds, original: designRef.current, pointerId: event.pointerId,
        clientX: event.clientX, clientY: event.clientY, zoom };
      return;
    }
    drag.current = {
      mode: "move", id: node.id, pointerId: event.pointerId,
      original: designRef.current,
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
      original: designRef.current,
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
    if (active.mode === "group") {
      const snapped = snapMove(active.original, active.ids, dx, dy, active.zoom);
      setGuides(snapped.guides);
      const moved = moveNodes(active.original, active.ids, snapped.dx, snapped.dy);
      if (Result.isFailure(moved)) { setError(moved.error.message); return; }
      if (moved.value !== designRef.current) previewDocument(moved.value);
      return;
    }
    const proposed = active.mode === "resize"
      ? { x: active.x, y: active.y, width: Math.max(1, active.width + dx), height: Math.max(1, active.height + dy) }
      : { x: active.x + dx, y: active.y + dy, width: active.width, height: active.height };
    const snapped = active.mode === "resize"
      ? snapResize(active.original, active.id, proposed, active.zoom)
      : (() => {
        const result = snapMove(active.original, [active.id], dx, dy, active.zoom);
        return { geometry: { ...proposed, x: active.x + result.dx, y: active.y + result.dy }, guides: result.guides };
      })();
    setGuides(snapped.guides);
    const geometry = snapped.geometry;
    const current = findNode(designRef.current, active.id);
    if (current && current.x === geometry.x && current.y === geometry.y && current.width === geometry.width && current.height === geometry.height) return;
    const moved = setNodeGeometry(active.original, active.id, geometry);
    if (Result.isFailure(moved)) { setError(moved.error.message); return; }
    previewDocument(moved.value);
  }

  function finishDrag(pointerId: number) {
    const active = drag.current;
    if (!active || active.pointerId !== pointerId) return;
    drag.current = null;
    setGuides([]);
    if (active.mode === "group") { finishPreview(designRef.current !== active.original); return; }
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

  function updateSelection(event: PointerEvent<HTMLDivElement>) {
    const active = selectionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const next = { ...active, end: pointOnCanvas(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), zoom) };
    selectionRef.current = next;
    setSelection(next);
  }

  function finishSelection(event: PointerEvent<HTMLDivElement>) {
    const active = selectionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    selectionRef.current = null;
    setSelection(null);
    const end = pointOnCanvas(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), zoom);
    const bounds = drawingGeometry(active.start, end);
    if (bounds.width < 3 || bounds.height < 3) {
      if (!active.additive) setSelectedIds([]);
      return;
    }
    const ids = nodesInBounds(designRef.current, bounds);
    setSelectedIds((current) => active.additive ? [...new Set([...current, ...ids])] : ids);
  }

  function cancelSelection(pointerId?: number) {
    if (!selectionRef.current || (pointerId !== undefined && selectionRef.current.pointerId !== pointerId)) return;
    selectionRef.current = null;
    setSelection(null);
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
    else if (event.target === event.currentTarget && !spacePressed.current && event.button === 0) {
      const start = pointOnCanvas(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), zoom);
      const next = { pointerId: event.pointerId, start, end: start, additive: event.shiftKey };
      selectionRef.current = next;
      setSelection(next);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && drawingRef.current) {
        cancelDrawing();
        setDrawTool("select");
        event.preventDefault();
        return;
      }
      if (event.key === "Escape" && selectionRef.current) { cancelSelection(); event.preventDefault(); return; }
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
    drag, zoom, setZoom, viewportRef, drawTool, setDrawTool, drawing, selection, guides,
    startDrag, startResize, continueDrag, finishDrag, stepHistory,
    startPan, continuePan, finishPan,
    onWorldPointerDown, updateDrawing, finishDrawing, cancelDrawing, updateSelection, finishSelection, cancelSelection,
  };
}
