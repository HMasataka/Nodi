import { useEffect, useMemo, useState } from "react";

import { measureNode } from "@/rendering/measure.ts";
import { resolveDocumentLayout } from "@/document/layout.ts";
import type { FrameNode, SpacingToken } from "@/document/types.ts";

import { Field } from "@/pages/editor/components/atoms/Field";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { Segmented } from "@/pages/editor/components/atoms/Segmented";

import { CanvasNode, type NodeInteraction } from "@/pages/editor/components/molecules/CanvasNode";

const noOp = () => {};
const previewInteraction: NodeInteraction = { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp };

// フレームを指定の幅にして自動レイアウトを解き直す。左上を原点に置き、プレビューの中で位置がずれないようにする。
export function resolvePreviewFrame(frame: FrameNode, width: number, spacing: SpacingToken[]): FrameNode {
  return resolveDocumentLayout({ version: 1, children: [{ ...frame, x: 0, y: 0, rotation: 0, width }], palette: [], spacing, components: [] },
    { measure: measureNode }).children[0] as FrameNode;
}

export const PREVIEW_WIDTHS = [320, 390, 768, 1024, 1440] as const;
const WIDTH_OPTIONS = PREVIEW_WIDTHS.map((width) => ({ value: String(width), label: String(width) }));

// 幅の入力。正の数だけを受け付け、それ以外は今の幅のままにする。
export function parsePreviewWidth(raw: string): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isFinite(value) && value > 0 ? value : null;
}

type PreviewStageProps = {
  frame: FrameNode;
  spacing: SpacingToken[];
  onClose(): void;
};

// プレビュー。選択中のフレームをキャンバスの中央に描き、編集の表示は出さない。上中央の × と Esc で編集に戻る。
export function PreviewStage({ frame, spacing, onClose }: PreviewStageProps) {
  const [width, setWidth] = useState(frame.width);
  const resolved = useMemo(() => resolvePreviewFrame(frame, width, spacing), [frame, width, spacing]);
  useEffect(() => {
    // Esc は選択の解除（ショートカット）より先に受け、プレビューを閉じるだけにする。
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [onClose]);
  return <section className="preview-mode" aria-label="プレビュー">
    {/* 幅の切り換えは上中央に浮かべ、プリセットか入力欄で描く幅を変える。プリセット以外の幅のときは、どれも選ばない。 */}
    <div className="canvas-chip preview-bar">
      <Segmented label="プレビューの幅" className="preview-widths" value={String(width)} options={WIDTH_OPTIONS} onChange={(value) => setWidth(Number(value))} />
      <Field className="preview-width" label="幅" type="number" min="1" step="any" value={String(width)}
        onCommit={(raw) => { const value = parsePreviewWidth(raw); if (value !== null) setWidth(value); }} />
      <span className="preview-bar-divider" aria-hidden="true" />
      <IconButton icon="close" label="プレビューを閉じる" onClick={onClose} />
    </div>
    <div className="preview-canvas">
      <div className="preview-artboard" style={{ width, height: resolved.height }}>
        <span className="preview-caption">{frame.name} · {Math.round(width)} px</span>
        <CanvasNode node={resolved} selectedId={null} interaction={previewInteraction} />
      </div>
    </div>
  </section>;
}
