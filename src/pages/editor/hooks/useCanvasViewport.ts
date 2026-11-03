import { flushSync } from "react-dom";
import { Result } from "@praha/byethrow";
import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";

import { absoluteGeometry } from "@/pages/editor/geometry";
import type { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import { canvasExtent, focusViewport, panScroll, screenGeometry } from "@/pages/editor/viewport";
import type { DragState, PanState } from "@/pages/editor/types";

const SPACE_PAN_EXCLUDED = "input, textarea, [contenteditable], button:not(.canvas-node)";

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

export function useCanvasViewport(session: ReturnType<typeof useEditorDocument>, drag: RefObject<DragState | null>) {
  const { designRef, focusElementRef, setSelectedId } = session;
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLElement | null>(null);
  const pan = useRef<PanState | null>(null);
  const spacePressed = useSpacePressed();

  function focusElement(id: string) {
    const viewport = viewportRef.current;
    const absolute = absoluteGeometry(designRef.current, id);
    if (!absolute) return Result.fail(new Error(`要素が見つかりません: ${id}`));
    if (!viewport || viewport.clientWidth === 0 || viewport.clientHeight === 0) return unavailableFocus();

    const extent = canvasExtent(designRef.current);
    const target = focusViewport(absolute, extent, { width: viewport.clientWidth, height: viewport.clientHeight }, zoom);
    // 先に倍率を画面へ反映し、新しいスクロール可能範囲で移動する。
    flushSync(() => { setZoom(target.zoom); setSelectedId(id); });
    viewport.scrollLeft = target.scrollLeft;
    viewport.scrollTop = target.scrollTop;
    const scroll = { scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop };
    return Result.succeed({ absolute, zoom: target.zoom, ...scroll, screen: screenGeometry(absolute, extent, target.zoom, scroll) });
  }

  useEffect(() => {
    focusElementRef.current = focusElement;
    return () => { focusElementRef.current = unavailableFocus; };
  }, [designRef, focusElementRef, setSelectedId, zoom]);

  function startPan(event: PointerEvent<HTMLElement>) {
    if (drag.current || pan.current) return;
    if (event.button !== 1 && !spacePressed.current) return;
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
    const scroll = panScroll(active, event);
    event.currentTarget.scrollLeft = scroll.scrollLeft;
    event.currentTarget.scrollTop = scroll.scrollTop;
  }

  function finishPan(pointerId: number) {
    if (pan.current?.pointerId === pointerId) pan.current = null;
  }

  return { zoom, setZoom, viewportRef, pan, spacePressed, startPan, continuePan, finishPan };
}
