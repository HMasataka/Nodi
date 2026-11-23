import type { PointerEvent } from "react";

import type { ResizeCorner } from "@/pages/editor/geometry";

const CORNER_CLASS = { "0,0": "is-top-left", "1,0": "is-top-right", "0,1": "is-bottom-left", "1,1": "is-bottom-right" } as const;

// 選択枠の角に付ける 8px 角のつまみ。倍率に依らず画面上で同じ大きさに描く。
export function ResizeHandle({ corner, onPointerDown }: { corner: ResizeCorner; onPointerDown(event: PointerEvent<HTMLSpanElement>): void }) {
  return <span className={`resize-handle ${CORNER_CLASS[`${corner.x},${corner.y}`]}`} aria-hidden="true" onPointerDown={onPointerDown} />;
}
