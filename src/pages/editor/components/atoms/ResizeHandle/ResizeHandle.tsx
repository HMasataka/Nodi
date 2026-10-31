import type { PointerEvent } from "react";

export function ResizeHandle({ onPointerDown }: { onPointerDown(event: PointerEvent<HTMLSpanElement>): void }) {
  return <span className="resize-handle" aria-hidden="true" onPointerDown={onPointerDown} />;
}
