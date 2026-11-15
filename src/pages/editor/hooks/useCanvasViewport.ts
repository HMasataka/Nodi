import { flushSync } from "react-dom";
import { Result } from "@praha/byethrow";
import { type PointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";

import { absoluteGeometry } from "@/pages/editor/geometry";
import { listenForCanvasZoom } from "@/pages/editor/canvasZoomEvents";
import { measureNode } from "@/rendering/measure.ts";
import { panScroll } from "@/pages/editor/viewport";
import { resolveDocumentInstances } from "@/document/instances.ts";
import { resolveDocumentLayout } from "@/document/layout.ts";
import type { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import { cameraScreenGeometry, focusCamera, INITIAL_CAMERA, initialCamera, zoomCamera } from "@/pages/editor/camera.ts";
import type { DragState, PanState } from "@/pages/editor/types";

const SPACE_PAN_EXCLUDED = "input, textarea, [contenteditable], button:not(.canvas-node):not(.canvas-text):not(.canvas-image)";

function unavailableFocus() {
  return Result.fail(new Error("キャンバスを表示できません"));
}

function useSpacePressed() {
  const pressed = useRef(false);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest(SPACE_PAN_EXCLUDED)) return;
      pressed.current = true;
      event.preventDefault();
    }
    function onKeyUp(event: KeyboardEvent) { if (event.code === "Space") pressed.current = false; }
    function onBlur() { pressed.current = false; }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  return pressed;
}

export function useCanvasViewport(session: ReturnType<typeof useEditorDocument>, drag: RefObject<DragState | null>, pointDrag?: RefObject<unknown>) {
  const { designRef, focusElementRef, setSelectedId, documentSession } = session;
  const [camera, setCamera] = useState(INITIAL_CAMERA);
  const cameraRef = useRef(camera);
  const zoom = camera.zoom;
  const viewportRef = useRef<HTMLElement | null>(null);
  const pan = useRef<PanState | null>(null);
  const spacePressed = useSpacePressed();
  const isInteracting = useCallback(() => !!(drag.current || pointDrag?.current || pan.current), [drag, pointDrag]);

  const updateCamera = useCallback((next: typeof camera) => {
    if (![next.zoom, next.scrollLeft, next.scrollTop].every(Number.isFinite)) return;
    cameraRef.current = next;
    setCamera(next);
  }, []);

  const zoomAt = useCallback((targetZoom: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport || isInteracting()) return;
    const rect = viewport.getBoundingClientRect();
    updateCamera(zoomCamera(cameraRef.current, targetZoom, { x: clientX - rect.left, y: clientY - rect.top }));
  }, [isInteracting, updateCamera]);

  function zoomBy(factor: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    zoomAt(cameraRef.current.zoom * factor, rect.left + viewport.clientWidth / 2, rect.top + viewport.clientHeight / 2);
  }

  function focusElement(id: string) {
    const viewport = viewportRef.current;
    if (isInteracting()) return Result.fail(new Error("操作中は表示位置を変更できません"));
    const absolute = absoluteGeometry(resolveDocumentLayout(resolveDocumentInstances(designRef.current), { measure: measureNode }), id);
    if (!absolute) return Result.fail(new Error(`要素が見つかりません: ${id}`));
    if (!viewport || viewport.clientWidth === 0 || viewport.clientHeight === 0) return unavailableFocus();

    const target = focusCamera(absolute, { width: viewport.clientWidth, height: viewport.clientHeight }, cameraRef.current.zoom);
    flushSync(() => { updateCamera(target); setSelectedId(id); });
    return Result.succeed({ absolute, ...target, screen: cameraScreenGeometry(absolute, target) });
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let initialized = false;
    const initialize = () => {
      if (initialized || !viewport.clientWidth || !viewport.clientHeight) return;
      initialized = true;
      const document = resolveDocumentLayout(resolveDocumentInstances(designRef.current), { measure: measureNode });
      updateCamera(initialCamera(document, { width: viewport.clientWidth, height: viewport.clientHeight }));
    };
    initialize();
    const observer = new ResizeObserver(initialize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [documentSession, designRef, updateCamera]);

  useEffect(() => {
    focusElementRef.current = focusElement;
    return () => { focusElementRef.current = unavailableFocus; };
  }, [designRef, focusElementRef, setSelectedId, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    return listenForCanvasZoom(viewport, () => cameraRef.current.zoom, zoomAt, (dx, dy) => {
      const current = cameraRef.current;
      updateCamera({ ...current, scrollLeft: current.scrollLeft + dx, scrollTop: current.scrollTop + dy });
    }, isInteracting);
  }, [zoomAt, updateCamera, isInteracting]);

  function startPan(event: PointerEvent<HTMLElement>) {
    if (isInteracting()) return;
    if (event.button !== 1 && !spacePressed.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pan.current = {
      pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      scrollLeft: cameraRef.current.scrollLeft, scrollTop: cameraRef.current.scrollTop,
    };
  }

  function continuePan(event: PointerEvent<HTMLElement>) {
    const active = pan.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const scroll = panScroll(active, event);
    updateCamera({ ...cameraRef.current, ...scroll });
  }

  function finishPan(pointerId: number) {
    if (pan.current?.pointerId === pointerId) pan.current = null;
  }

  return { camera, zoom, zoomBy, viewportRef, pan, spacePressed, startPan, continuePan, finishPan };
}
