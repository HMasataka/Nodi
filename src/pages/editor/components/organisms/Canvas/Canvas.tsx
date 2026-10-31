import type { Dispatch, PointerEvent, SetStateAction } from "react";
import { drawingGeometry } from "@/pages/editor/geometry";
import type { Document } from "@/document/types";
import { clampZoom } from "@/pages/editor/viewport";
import { CanvasNode, type NodeInteraction } from "@/pages/editor/components/molecules/CanvasNode";
import type { DrawingState, DrawTool } from "@/pages/editor/types";

interface CanvasProps extends NodeInteraction {
  design: Document;
  selectedId: string | null;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  drawTool: DrawTool;
  drawing: DrawingState | null;
  onPanPointerDown(event: PointerEvent<HTMLElement>): void;
  onPanPointerMove(event: PointerEvent<HTMLElement>): void;
  onPanPointerUp(pointerId: number): void;
  onWorldPointerDown(event: PointerEvent<HTMLDivElement>): void;
  onWorldPointerMove(event: PointerEvent<HTMLDivElement>): void;
  onWorldPointerUp(event: PointerEvent<HTMLDivElement>): void;
  onWorldPointerCancel(pointerId: number): void;
}

export function Canvas(props: CanvasProps) {
  const {
    design, selectedId, zoom, setZoom, drawTool, drawing,
    onPanPointerDown, onPanPointerMove, onPanPointerUp,
    onWorldPointerDown, onWorldPointerMove, onWorldPointerUp, onWorldPointerCancel,
  } = props;
  const interaction: NodeInteraction = {
    onNodePointerDown: props.onNodePointerDown,
    onResizePointerDown: props.onResizePointerDown,
    onNodePointerMove: props.onNodePointerMove,
    onNodePointerUp: props.onNodePointerUp,
    onImageError: props.onImageError,
  };
  const preview = drawing ? drawingGeometry(drawing.start, drawing.end, drawing.parentOrigin) : null;

  return (
    <section className="canvas-viewport" aria-label="キャンバス"
      onPointerDown={onPanPointerDown} onPointerMove={onPanPointerMove}
      onPointerUp={(event) => onPanPointerUp(event.pointerId)}
      onPointerCancel={(event) => onPanPointerUp(event.pointerId)}
      onLostPointerCapture={(event) => onPanPointerUp(event.pointerId)}>
      <div className="canvas-surface"
        style={{ width: `max(100%, ${1200 * zoom}px)`, height: `max(100%, ${900 * zoom}px)`, backgroundSize: `${24 * zoom}px ${24 * zoom}px` }}>
        <div className={`canvas-world${drawTool !== "select" ? " is-drawing" : ""}`}
          style={{ transform: `scale(${zoom})` }} onPointerDown={onWorldPointerDown}
          onPointerMove={onWorldPointerMove} onPointerUp={onWorldPointerUp}
          onPointerCancel={(event) => onWorldPointerCancel(event.pointerId)}
          onLostPointerCapture={(event) => onWorldPointerCancel(event.pointerId)}>
          {design.children.length === 0 && <div className="canvas-hint" aria-hidden="true"><span className="hint-symbol">＋</span><span>ここから、かたちをつくる。</span></div>}
          {design.children.map((node) => <CanvasNode key={node.id} node={node} selectedId={selectedId} interaction={interaction} />)}
          {drawing && preview && <div className={`draw-preview${drawing.tool === "ellipse" ? " is-ellipse" : ""}`}
            style={{ left: preview.x + drawing.parentOrigin.x, top: preview.y + drawing.parentOrigin.y, width: preview.width, height: preview.height }} />}
        </div>
      </div>
      <div className="canvas-scale">
        <button type="button" onClick={() => setZoom((value) => clampZoom(value / 1.25))} aria-label="縮小">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => clampZoom(value * 1.25))} aria-label="拡大">＋</button>
      </div>
    </section>
  );
}
