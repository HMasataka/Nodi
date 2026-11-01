import type { Dispatch, PointerEvent, Ref, SetStateAction } from "react";
import { drawingGeometry } from "@/pages/editor/geometry";
import type { Document } from "@/document/types";
import { canvasExtent, clampZoom } from "@/pages/editor/viewport";
import { CanvasNode, type NodeInteraction } from "@/pages/editor/components/molecules/CanvasNode";
import type { DrawingState, DrawTool } from "@/pages/editor/types";
import type { SnapGuide } from "@/pages/editor/snapping";

interface CanvasProps extends NodeInteraction {
  design: Document;
  selectedId: string | null;
  selectedIds?: string[];
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  viewportRef?: Ref<HTMLElement>;
  drawTool: DrawTool;
  drawing: DrawingState | null;
  selection?: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  guides?: SnapGuide[];
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
    design, selectedId, selectedIds, zoom, setZoom, viewportRef, drawTool, drawing, selection, guides = [],
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
  const extent = canvasExtent(design);

  return (
    <section ref={viewportRef} className="canvas-viewport" aria-label="キャンバス"
      onPointerDown={onPanPointerDown} onPointerMove={onPanPointerMove}
      onPointerUp={(event) => onPanPointerUp(event.pointerId)}
      onPointerCancel={(event) => onPanPointerUp(event.pointerId)}
      onLostPointerCapture={(event) => onPanPointerUp(event.pointerId)}>
      <div className="canvas-surface"
        style={{ width: `max(100%, ${extent.width * zoom}px)`, height: `max(100%, ${extent.height * zoom}px)`, backgroundSize: `${24 * zoom}px ${24 * zoom}px` }}>
        <div className={`canvas-world${drawTool !== "select" ? " is-drawing" : ""}`}
          style={{ transform: `translate(${extent.originX * zoom}px, ${extent.originY * zoom}px) scale(${zoom})` }} onPointerDown={onWorldPointerDown}
          onPointerMove={onWorldPointerMove} onPointerUp={onWorldPointerUp}
          onPointerCancel={(event) => onWorldPointerCancel(event.pointerId)}
          onLostPointerCapture={(event) => onWorldPointerCancel(event.pointerId)}>
          {design.children.length === 0 && <div className="canvas-hint" aria-hidden="true"><span className="hint-symbol">＋</span><span>ここから、かたちをつくる。</span></div>}
           {design.children.map((node) => <CanvasNode key={node.id} node={node} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} />)}
           {selection && <div className="selection-preview" style={{ left: Math.min(selection.start.x, selection.end.x), top: Math.min(selection.start.y, selection.end.y), width: Math.abs(selection.end.x - selection.start.x), height: Math.abs(selection.end.y - selection.start.y) }} />}
           {guides.map((guide, index) => <div key={`${guide.orientation}:${index}`} className={`alignment-guide ${guide.orientation}`}
             style={guide.orientation === "vertical" ? { left: guide.position, top: guide.from, height: guide.to - guide.from } : { top: guide.position, left: guide.from, width: guide.to - guide.from }} />)}
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
