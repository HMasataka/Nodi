import type { PointerEvent, Ref } from "react";

import type { Document } from "@/document/types";
import type { SelectionSpacing, TextIconAlignment } from "@/document/commands/index.ts";

import type { CanvasCamera } from "@/pages/editor/camera.ts";
import { drawingGeometry } from "@/pages/editor/geometry";
import type { SnapGuide } from "@/pages/editor/snapping";
import { transformPoint } from "@/document/transform.ts";
import { CanvasNodes, type NodeInteraction } from "@/pages/editor/components/molecules/CanvasNode";
import { canvasSurfaceStyle, canvasWorldStyle, drawPreviewStyle, guideStyle, selectionPreviewStyle } from "@/pages/editor/canvasStyles";
import type { DrawingState, DrawTool, PenState } from "@/pages/editor/types";


interface CanvasProps extends NodeInteraction {
  design: Document;
  selectedId: string | null;
  selectedIds?: string[];
  zoom: number;
  camera?: CanvasCamera;
  viewportRef?: Ref<HTMLElement>;
  drawTool: DrawTool;
  drawing: DrawingState | null;
  pen: PenState | null;
  selection?: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  guides?: SnapGuide[];
  spacing?: { x?: SelectionSpacing; y?: SelectionSpacing; error?: string };
  textIcon?: { measurement?: TextIconAlignment; error?: string };
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
    design, selectedId, selectedIds, zoom, camera = { zoom, scrollLeft: 0, scrollTop: 0 }, viewportRef, drawTool, drawing, pen, selection, guides = [], spacing, textIcon,
    onPanPointerDown, onPanPointerMove, onPanPointerUp, onWorldDoubleClick,
    onWorldPointerDown, onWorldPointerMove, onWorldPointerUp, onWorldPointerCancel,
  } = props;
  const interaction: NodeInteraction = {
    onNodePointerDown: props.onNodePointerDown,
    onResizePointerDown: props.onResizePointerDown,
    onNodePointerMove: props.onNodePointerMove,
    onNodePointerUp: props.onNodePointerUp,
    onImageError: props.onImageError,
    onNodeEnter: props.onNodeEnter,
    onNodeLeave: props.onNodeLeave,
    onNodeClick: props.onNodeClick,
    onPathPointPointerDown: props.onPathPointPointerDown,
    onPathPointPointerMove: props.onPathPointPointerMove,
    onPathPointPointerUp: props.onPathPointPointerUp,
    onPathPointPointerCancel: props.onPathPointPointerCancel,
  };
  const preview = drawing ? drawingGeometry(drawing.start, drawing.end, drawing.parentTransform) : null;
  const penPoints = pen?.points.map((point) => transformPoint(pen.parentTransform, point)) ?? [];
  const penCursor = pen ? transformPoint(pen.parentTransform, pen.cursor) : null;

  return (
    <div className="canvas-container">
      <section ref={viewportRef} className="canvas-viewport" aria-label="キャンバス"
        onPointerDownCapture={onPanPointerDown} onPointerMove={onPanPointerMove}
        onPointerUp={(event) => onPanPointerUp(event.pointerId)}
        onPointerCancel={(event) => onPanPointerUp(event.pointerId)}
        onLostPointerCapture={(event) => onPanPointerUp(event.pointerId)}>
        <div className={`canvas-surface${drawTool !== "select" ? " is-drawing" : ""}`} style={canvasSurfaceStyle(camera)}
            onPointerDown={onWorldPointerDown} onDoubleClick={onWorldDoubleClick}
            onPointerMove={onWorldPointerMove} onPointerUp={onWorldPointerUp}
            onPointerCancel={(event) => onWorldPointerCancel(event.pointerId)}
            onLostPointerCapture={(event) => onWorldPointerCancel(event.pointerId)}>
          <div className="canvas-world" style={canvasWorldStyle(camera)}>
            {design.children.length === 0 && <div className="canvas-hint" aria-hidden="true"><span className="hint-symbol">＋</span><span>ここから、かたちをつくる。</span></div>}
            <CanvasNodes nodes={design.children} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} zoom={zoom} />
            {selection && <div className="selection-preview" style={selectionPreviewStyle(selection)} />}
            {guides.map((guide, index) => <div key={`${guide.orientation}:${index}`} className={`alignment-guide ${guide.orientation}`}
              style={guideStyle(guide)} />)}
            {spacing && !spacing.error && <svg className="spacing-guides" aria-hidden="true">
              {([spacing.x, spacing.y] as const).flatMap((measurement) => measurement?.intervals.map(({ from, to, distance }, index) => {
                const horizontal = measurement.axis === "x";
                const x1 = horizontal ? from.x + from.width : from.x + from.width / 2;
                const x2 = horizontal ? to.x : to.x + to.width / 2;
                const y1 = horizontal ? from.y + from.height / 2 : from.y + from.height;
                const y2 = horizontal ? to.y + to.height / 2 : to.y;
                return <g key={`${measurement.axis}:${index}`}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1 / zoom} />
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5 / zoom} fontSize={11 / zoom} textAnchor="middle">{Number(distance.toFixed(1))} px</text>
                </g>;
              }) ?? [])}
            </svg>}
            {textIcon?.measurement && <svg className="text-icon-guides" aria-hidden="true">
              <line x1={textIcon.measurement.fromX} x2={textIcon.measurement.toX} y1={textIcon.measurement.textY} y2={textIcon.measurement.textY}
                strokeWidth={1 / zoom} />
              <circle cx={textIcon.measurement.toX} cy={textIcon.measurement.iconY} r={3 / zoom} strokeWidth={1 / zoom} />
              <text x={textIcon.measurement.toX + 6 / zoom} y={textIcon.measurement.textY - 5 / zoom} fontSize={11 / zoom}>
                {Number(textIcon.measurement.offset.toFixed(1))} px
              </text>
            </svg>}
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
    </div>
  );
}
