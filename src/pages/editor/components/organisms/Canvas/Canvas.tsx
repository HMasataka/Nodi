import type { PointerEvent, Ref } from "react";

import type { Document } from "@/document/types";

import { canvasExtent } from "@/pages/editor/viewport";
import { drawingGeometry } from "@/pages/editor/geometry";
import type { SnapGuide } from "@/pages/editor/snapping";
import { transformPoint } from "@/document/transform.ts";
import { CanvasNodes, type NodeInteraction } from "@/pages/editor/components/molecules/CanvasNode";
import { canvasSurfaceStyle, canvasWorldStyle, drawPreviewStyle, guideStyle, selectionPreviewStyle } from "@/pages/editor/canvasStyles";
import type { DrawingState, DrawTool, PenState } from "@/pages/editor/types";

const BUTTON_ZOOM_FACTOR = 1.1;

interface CanvasProps extends NodeInteraction {
  design: Document;
  selectedId: string | null;
  selectedIds?: string[];
  zoom: number;
  onZoom(factor: number): void;
  viewportRef?: Ref<HTMLElement>;
  drawTool: DrawTool;
  drawing: DrawingState | null;
  pen: PenState | null;
  selection?: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  guides?: SnapGuide[];
  onPanPointerDown(event: PointerEvent<HTMLElement>): void;
  onPanPointerMove(event: PointerEvent<HTMLElement>): void;
  onPanPointerUp(pointerId: number): void;
  onWorldPointerDown(event: PointerEvent<HTMLDivElement>): void;
  onWorldDoubleClick(): void;
  onWorldPointerMove(event: PointerEvent<HTMLDivElement>): void;
  onWorldPointerUp(event: PointerEvent<HTMLDivElement>): void;
  onWorldPointerCancel(pointerId: number): void;
}

export function Canvas(props: CanvasProps) {
  const {
    design, selectedId, selectedIds, zoom, onZoom, viewportRef, drawTool, drawing, pen, selection, guides = [],
    onPanPointerDown, onPanPointerMove, onPanPointerUp, onWorldDoubleClick,
    onWorldPointerDown, onWorldPointerMove, onWorldPointerUp, onWorldPointerCancel,
  } = props;
  const interaction: NodeInteraction = {
    onNodePointerDown: props.onNodePointerDown,
    onResizePointerDown: props.onResizePointerDown,
    onNodePointerMove: props.onNodePointerMove,
    onNodePointerUp: props.onNodePointerUp,
    onImageError: props.onImageError,
  };
  const preview = drawing ? drawingGeometry(drawing.start, drawing.end, drawing.parentTransform) : null;
  const penPoints = pen?.points.map((point) => transformPoint(pen.parentTransform, point)) ?? [];
  const penCursor = pen ? transformPoint(pen.parentTransform, pen.cursor) : null;
  const extent = canvasExtent(design);

  return (
    <div className="canvas-container">
      <section ref={viewportRef} className="canvas-viewport" aria-label="キャンバス"
        onPointerDown={onPanPointerDown} onPointerMove={onPanPointerMove}
        onPointerUp={(event) => onPanPointerUp(event.pointerId)}
        onPointerCancel={(event) => onPanPointerUp(event.pointerId)}
        onLostPointerCapture={(event) => onPanPointerUp(event.pointerId)}>
        <div className="canvas-surface" style={canvasSurfaceStyle(extent, zoom)}>
          <div className={`canvas-world${drawTool !== "select" ? " is-drawing" : ""}`}
            style={canvasWorldStyle(extent, zoom)} onPointerDown={onWorldPointerDown} onDoubleClick={onWorldDoubleClick}
            onPointerMove={onWorldPointerMove} onPointerUp={onWorldPointerUp}
            onPointerCancel={(event) => onWorldPointerCancel(event.pointerId)}
            onLostPointerCapture={(event) => onWorldPointerCancel(event.pointerId)}>
            {design.children.length === 0 && <div className="canvas-hint" aria-hidden="true"><span className="hint-symbol">＋</span><span>ここから、かたちをつくる。</span></div>}
            <CanvasNodes nodes={design.children} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} />
            {selection && <div className="selection-preview" style={selectionPreviewStyle(selection)} />}
            {guides.map((guide, index) => <div key={`${guide.orientation}:${index}`} className={`alignment-guide ${guide.orientation}`}
              style={guideStyle(guide)} />)}
            {drawing && preview && <div className={`draw-preview${drawing.tool === "ellipse" ? " is-ellipse" : ""}`}
               style={drawPreviewStyle(preview, drawing.parentTransform)} />}
            {pen && <svg className="pen-preview" aria-hidden="true">
              <polyline points={[...penPoints, ...(penCursor ? [penCursor] : [])].map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none" stroke="currentColor" strokeWidth={2 / zoom} strokeDasharray={`${5 / zoom} ${3 / zoom}`} />
              {penPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={4 / zoom}
                fill={index === 0 ? "#ffffff" : "currentColor"} stroke="currentColor" strokeWidth={2 / zoom} />)}
            </svg>}
          </div>
        </div>
      </section>
      <div className="canvas-scale">
        <button type="button" onClick={() => onZoom(1 / BUTTON_ZOOM_FACTOR)} aria-label="縮小">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoom(BUTTON_ZOOM_FACTOR)} aria-label="拡大">＋</button>
      </div>
    </div>
  );
}
