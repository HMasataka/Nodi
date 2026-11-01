import { flushSync } from "react-dom";
import { Result } from "@praha/byethrow";
import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";

import { absoluteGeometry } from "@/pages/editor/geometry";
import type { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import { canvasExtent, focusViewport } from "@/pages/editor/viewport";
import type { DragState, PanState } from "@/pages/editor/types";

export function useCanvasViewport(session: ReturnType<typeof useEditorDocument>, drag: RefObject<DragState | null>) {
  const { designRef, focusElementRef, setSelectedId } = session;
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLElement | null>(null);
  const pan = useRef<PanState | null>(null);
  const spacePressed = useRef(false);

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, [contenteditable], button:not(.canvas-node)")) return;
      spacePressed.current = true;
      event.preventDefault();
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
  }, []);

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

  return { zoom, setZoom, viewportRef, pan, spacePressed, startPan, continuePan, finishPan };
}
