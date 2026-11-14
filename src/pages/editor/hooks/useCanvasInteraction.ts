import { Result } from "@praha/byethrow";
import { type PointerEvent, useEffect, useRef, useState } from "react";

import { cameraWorldPoint } from "@/pages/editor/camera.ts";
import { listLocatedNodes } from "@/document/geometry.ts";
import { movePathPoint } from "@/document/pathEdit.ts";
import type { PathPointPart } from "@/document/pathEdit.ts";
import { screenDeltaToDocument } from "@/pages/editor/viewport";
import { toggleSelection } from "@/pages/editor/selection";
import { useCanvasViewport } from "@/pages/editor/hooks/useCanvasViewport";
import type { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import type { Document, DocumentNode, PathNode } from "@/document/types";
import type { DragState, DrawingState, DrawTool, PenState, SelectionRegion } from "@/pages/editor/types";
import { drawingGeometry, frameTransform, nodesInBounds, resizeFromWorldDelta } from "@/pages/editor/geometry";
import { extendPen, finishPenInput, penLocalPoint } from "@/pages/editor/pen.ts";
import { findNode, moveNodes, setNodeGeometry, setPath } from "@/document/commands/index.ts";
import { IDENTITY_TRANSFORM, invertTransform, transformPoint, transformVector } from "@/document/transform.ts";
import { type SnapGuide, snapMove, snapResize } from "@/pages/editor/snapping";

export function useCanvasInteraction(session: ReturnType<typeof useEditorDocument>) {
  const {
    designRef, selectedIds, setSelectedId, setSelectedIds, setError, agentApi,
    beginPreview, previewDocument, finishPreview, stepHistory: stepDocumentHistory,
  } = session;
  const drag = useRef<DragState | null>(null);
  const pathDrag = useRef<{ original: Document; node: PathNode; index: number; part: PathPointPart; pointerId: number } | null>(null);
  const { camera, zoom, zoomBy, viewportRef, pan, spacePressed, startPan, continuePan, finishPan } = useCanvasViewport(session, drag, pathDrag);
  const [drawTool, setDrawToolState] = useState<DrawTool>("select");
  const [pen, setPen] = useState<PenState | null>(null);
  const penRef = useRef<PenState | null>(null);
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const drawingRef = useRef<DrawingState | null>(null);
  const [selection, setSelection] = useState<SelectionRegion | null>(null);
  const selectionRef = useRef<SelectionRegion | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);

  function worldPoint(event: PointerEvent<Element>) {
    const viewport = viewportRef.current!;
    const rect = viewport.getBoundingClientRect();
    return cameraWorldPoint(camera, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  function cancelPen() {
    penRef.current = null;
    setPen(null);
  }

  function setDrawTool(tool: DrawTool) {
    cancelPathPointDrag();
    if (tool !== "path") cancelPen();
    if (tool !== "rectangle" && tool !== "ellipse") cancelDrawing();
    setDrawToolState(tool);
  }

  function startPathPointDrag(event: PointerEvent<SVGCircleElement>, node: PathNode, index: number, part: PathPointPart) {
    if (event.button !== 0 || drag.current || pathDrag.current || spacePressed.current || drawTool !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginPreview();
    pathDrag.current = { original: designRef.current, node, index, part, pointerId: event.pointerId };
  }

  function continuePathPointDrag(event: PointerEvent<SVGCircleElement>) {
    const active = pathDrag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const world = worldPoint(event);
    const located = listLocatedNodes(active.original).find(({ node }) => node.id === active.node.id);
    if (!located) return;
    const local = transformPoint(invertTransform(located.world), world);
    const commands = movePathPoint(active.node.commands, active.index, active.part,
      { x: local.x / active.node.width, y: local.y / active.node.height });
    if (!commands) return;
    const result = setPath(active.original, active.node.id, { commands });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    previewDocument(result.value);
  }

  function finishPathPointDrag(pointerId: number) {
    const active = pathDrag.current;
    if (!active || active.pointerId !== pointerId) return;
    pathDrag.current = null;
    const final = findNode(designRef.current, active.node.id);
    finishPreview(final?.type === "path" && JSON.stringify(final.commands) !== JSON.stringify(active.node.commands));
  }

  function cancelPathPointDrag() {
    if (!pathDrag.current) return;
    pathDrag.current = null;
    finishPreview(false);
  }

  function finishPen(closed: boolean) {
    const active = penRef.current;
    if (!active) return;
    const input = finishPenInput(active, closed);
    if (!input) return;
    const result = agentApi.add(input);
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    cancelPen();
    setSelectedId(result.value.id);
    setDrawTool("select");
  }

  function penPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || spacePressed.current || pan.current) return;
    event.preventDefault();
    event.stopPropagation();
    const world = worldPoint(event);
    const active = penRef.current;
    if (active) {
      const point = penLocalPoint(world, active.parentTransform);
      const result = extendPen(active, point, zoom);
      if (result.kind === "close") finishPen(true);
      else if (result.kind === "limit") setError("ペンで追加できる点は2047個までです");
      else if (result.kind === "append") { penRef.current = result.draft; setPen(result.draft); }
      return;
    }
    const frameId = event.target instanceof Element ? event.target.closest("[data-frame-id]")?.getAttribute("data-frame-id") ?? null : null;
    const parentTransform = frameId ? frameTransform(designRef.current, frameId) : IDENTITY_TRANSFORM;
    if (!parentTransform) return;
    const point = penLocalPoint(world, parentTransform);
    const next = { parentId: frameId, parentTransform, points: [point], cursor: point };
    penRef.current = next;
    setPen(next);
  }

  function updatePenCursor(event: PointerEvent<HTMLDivElement>) {
    const active = penRef.current;
    if (!active) return;
    const world = worldPoint(event);
    const next = { ...active, cursor: penLocalPoint(world, active.parentTransform) };
    penRef.current = next;
    setPen(next);
  }

  function startDrag(event: PointerEvent<HTMLElement>, node: DocumentNode) {
    if (event.button !== 0 || drag.current || spacePressed.current || drawTool !== "select") return;
    event.stopPropagation();
    if (event.shiftKey) {
      setSelectedIds((ids) => toggleSelection(ids, node.id));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    beginPreview();
    if (selectedIds.length > 1 && selectedIds.includes(node.id)) {
      drag.current = { mode: "group", ids: selectedIds, original: designRef.current, pointerId: event.pointerId,
        clientX: event.clientX, clientY: event.clientY, zoom };
      return;
    }
    drag.current = {
      mode: "move", id: node.id, pointerId: event.pointerId,
      original: designRef.current,
      clientX: event.clientX, clientY: event.clientY,
      x: node.x, y: node.y, width: node.width, height: node.height, rotation: node.rotation,
      parentTransform: listLocatedNodes(designRef.current).find(({ node: item }) => item.id === node.id)?.parent ?? IDENTITY_TRANSFORM, zoom,
    };
    setSelectedId(node.id);
  }

  function startResize(event: PointerEvent<HTMLSpanElement>, node: DocumentNode) {
    if (event.button !== 0 || drag.current || spacePressed.current || drawTool !== "select") return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
    beginPreview();
    drag.current = {
      mode: "resize", id: node.id, pointerId: event.pointerId,
      original: designRef.current,
      clientX: event.clientX, clientY: event.clientY,
      x: node.x, y: node.y, width: node.width, height: node.height, rotation: node.rotation,
      parentTransform: listLocatedNodes(designRef.current).find(({ node: item }) => item.id === node.id)?.parent ?? IDENTITY_TRANSFORM, zoom,
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
      ? resizeFromWorldDelta(active, active.parentTransform, { x: dx, y: dy })
      : { x: active.x, y: active.y, width: active.width, height: active.height };
    const snapped = active.mode === "resize"
      ? snapResize(active.original, active.id, proposed, active.zoom)
      : (() => {
        const result = snapMove(active.original, [active.id], dx, dy, active.zoom);
        const local = transformVector(invertTransform(active.parentTransform), { x: result.dx, y: result.dy });
        return { geometry: { x: active.x + local.x, y: active.y + local.y, width: active.width, height: active.height }, guides: result.guides };
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
    if (!drag.current && !pathDrag.current && !penRef.current) stepDocumentHistory(direction);
  }

  function beginDrawing(event: PointerEvent<HTMLDivElement>) {
    if (drawTool === "select" || drawTool === "path" || event.button !== 0 || spacePressed.current || pan.current || drawingRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const frameId = event.target instanceof Element ? event.target.closest("[data-frame-id]")?.getAttribute("data-frame-id") ?? null : null;
    const parentTransform = frameId ? frameTransform(designRef.current, frameId) : IDENTITY_TRANSFORM;
    if (!parentTransform) return;
    const start = worldPoint(event);
    const next = { pointerId: event.pointerId, tool: drawTool, start, end: start, parentId: frameId, parentTransform };
    drawingRef.current = next;
    setDrawing(next);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateDrawing(event: PointerEvent<HTMLDivElement>) {
    const active = drawingRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const next = { ...active, end: worldPoint(event) };
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
    const next = { ...active, end: worldPoint(event) };
    selectionRef.current = next;
    setSelection(next);
  }

  function finishSelection(event: PointerEvent<HTMLDivElement>) {
    const active = selectionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    selectionRef.current = null;
    setSelection(null);
    const end = worldPoint(event);
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
    const end = worldPoint(event);
    const geometry = drawingGeometry(active.start, end, active.parentTransform);
    cancelDrawing(event.pointerId);
    if (geometry.width < 4 || geometry.height < 4) return;
    const result = agentApi.add({ type: active.tool, parentId: active.parentId ?? undefined, ...geometry });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
    setDrawTool("select");
  }

  function onWorldPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (drawTool === "path") penPointerDown(event);
    else if (drawTool !== "select") beginDrawing(event);
    else if (event.target === event.currentTarget && !spacePressed.current && event.button === 0) {
      const start = worldPoint(event);
      const next = { pointerId: event.pointerId, start, end: start, additive: event.shiftKey };
      selectionRef.current = next;
      setSelection(next);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && pathDrag.current) { cancelPathPointDrag(); event.preventDefault(); return; }
      if (event.key === "Escape" && drawingRef.current) {
        cancelDrawing();
        setDrawTool("select");
        event.preventDefault();
        return;
      }
      if (event.key === "Escape" && penRef.current) { cancelPen(); setDrawTool("select"); event.preventDefault(); return; }
      if (event.key === "Escape" && selectionRef.current) { cancelSelection(); event.preventDefault(); return; }
      const target = event.target instanceof HTMLElement ? event.target : null;
      const editing = target?.closest("input, textarea, [contenteditable]");
      if (event.key === "Enter" && penRef.current && !editing) { finishPen(false); event.preventDefault(); return; }
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== "z") return;
      if (editing) return;
      event.preventDefault();
      stepHistory(event.shiftKey ? "redo" : "undo");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  return {
    drag, pathDrag, camera, zoom, zoomBy, viewportRef, drawTool, setDrawTool, drawing, pen, selection, guides,
    startDrag, startResize, continueDrag, finishDrag, stepHistory,
    startPan, continuePan, finishPan,
    onWorldPointerDown, updateDrawing, finishDrawing, cancelDrawing, updatePenCursor, finishPen,
    startPathPointDrag, continuePathPointDrag, finishPathPointDrag, cancelPathPointDrag,
    updateSelection, finishSelection, cancelSelection,
  };
}
