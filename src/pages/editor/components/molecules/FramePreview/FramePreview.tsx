import { useMemo, useState } from "react";

import { measureNode } from "@/rendering/measure.ts";
import { resolveDocumentLayout } from "@/document/layout.ts";
import { CanvasNode, type NodeInteraction } from "@/pages/editor/components/molecules/CanvasNode";
import type { FrameNode, SpacingToken } from "@/document/types.ts";

const PRESETS = [320, 390, 768, 1024, 1440];
const PREVIEW_WIDTH = 232;

const noOp = () => {};
const previewInteraction: NodeInteraction = {
  onNodePointerDown: noOp,
  onResizePointerDown: noOp,
  onNodePointerMove: noOp,
  onNodePointerUp: noOp,
  onImageError: noOp,
};

export function FramePreview({ frame, spacing = [] }: { frame: FrameNode; spacing?: SpacingToken[] }) {
  const [input, setInput] = useState(String(frame.width));
  const width = (() => {
    const value = Number(input);
    return Number.isFinite(value) && value > 0 ? value : frame.width;
  })();
  const resolved = useMemo(() => resolveDocumentLayout(
    { version: 1, children: [{ ...frame, width }], palette: [], spacing, components: [] }, { measure: measureNode },
  ).children[0] as FrameNode, [frame, width, spacing]);
  const scale = PREVIEW_WIDTH / width;
  const height = frame.height * scale;

  return <div className="frame-preview">
    <div className="preview-controls">
      {PRESETS.map((preset) => <button key={preset} type="button" className={`file-button${width === preset ? " is-active" : ""}`}
        onClick={() => setInput(String(preset))}>{preset}</button>)}
      <label className="preview-width-field">幅
        <input type="number" min="1" step="any" value={input}
          onChange={(event) => setInput(event.currentTarget.value)} />
      </label>
    </div>
    <div className="preview-stage" style={{ width: PREVIEW_WIDTH, height }}>
      <div className="preview-frame" style={{ width, height: frame.height, transform: `scale(${scale})` }}>
        <CanvasNode node={resolved} selectedId={null} interaction={previewInteraction} />
      </div>
    </div>
  </div>;
}
