import { useEffect, useMemo } from "react";

import { measureNode } from "@/rendering/measure.ts";
import { resolveDocumentLayout } from "@/document/layout.ts";
import type { FrameNode, SpacingToken } from "@/document/types.ts";

import { IconButton } from "@/pages/editor/components/atoms/IconButton";

import { CanvasNode, type NodeInteraction } from "@/pages/editor/components/molecules/CanvasNode";

const noOp = () => {};
const previewInteraction: NodeInteraction = { onNodePointerDown: noOp, onResizePointerDown: noOp, onNodePointerMove: noOp, onNodePointerUp: noOp, onImageError: noOp };

// フレームを指定の幅にして自動レイアウトを解き直す。左上を原点に置き、プレビューの中で位置がずれないようにする。
export function resolvePreviewFrame(frame: FrameNode, width: number, spacing: SpacingToken[]): FrameNode {
  return resolveDocumentLayout({ version: 1, children: [{ ...frame, x: 0, y: 0, rotation: 0, width }], palette: [], spacing, components: [] },
    { measure: measureNode }).children[0] as FrameNode;
}

type PreviewStageProps = {
  frame: FrameNode;
  spacing: SpacingToken[];
  width?: number;
  onClose(): void;
};

// プレビュー。選択中のフレームをキャンバスの中央に描き、編集の表示は出さない。上中央の × と Esc で編集に戻る。
export function PreviewStage({ frame, spacing, width = frame.width, onClose }: PreviewStageProps) {
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
    <div className="canvas-chip preview-bar">
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
