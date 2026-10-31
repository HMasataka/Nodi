import type { Dispatch, PointerEvent, SetStateAction } from "react";
import { drawingGeometry } from "../../../document/drawing";
import type { Document, DocumentNode } from "../../../document/types";
import { clampZoom } from "../../../document/viewport";
import type { DrawingState, DrawTool } from "../types";

interface CanvasProps {
  design: Document;
  selectedId: string | null;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  drawTool: DrawTool;
  drawing: DrawingState | null;
  onNodePointerDown(event: PointerEvent<HTMLElement>, node: DocumentNode): void;
  onResizePointerDown(event: PointerEvent<HTMLSpanElement>, node: DocumentNode): void;
  onNodePointerMove(event: PointerEvent<HTMLElement>): void;
  onNodePointerUp(pointerId: number): void;
  onPanPointerDown(event: PointerEvent<HTMLElement>): void;
  onPanPointerMove(event: PointerEvent<HTMLElement>): void;
  onPanPointerUp(pointerId: number): void;
  onWorldPointerDown(event: PointerEvent<HTMLDivElement>): void;
  onWorldPointerMove(event: PointerEvent<HTMLDivElement>): void;
  onWorldPointerUp(event: PointerEvent<HTMLDivElement>): void;
  onWorldPointerCancel(pointerId: number): void;
  onImageError(id: string): void;
}

export function Canvas(props: CanvasProps) {
  const {
    design, selectedId, zoom, setZoom, drawTool, drawing,
    onNodePointerDown, onResizePointerDown, onNodePointerMove, onNodePointerUp,
    onPanPointerDown, onPanPointerMove, onPanPointerUp,
    onWorldPointerDown, onWorldPointerMove, onWorldPointerUp, onWorldPointerCancel, onImageError,
  } = props;

  function renderNode(node: DocumentNode): React.ReactNode {
    const style = { left: node.x, top: node.y, width: node.width, height: node.height };
    if (node.type === "frame") return (
      <div key={node.id} className={`canvas-frame${selectedId === node.id ? " is-selected" : ""}`}
        role="group" aria-label={node.name} style={style}
        onPointerDown={(event) => { if (event.target === event.currentTarget) onNodePointerDown(event, node); }}
        onPointerMove={onNodePointerMove}
        onPointerUp={(event) => onNodePointerUp(event.pointerId)}
        onPointerCancel={(event) => onNodePointerUp(event.pointerId)}
        onLostPointerCapture={(event) => onNodePointerUp(event.pointerId)}>
        {node.children.map(renderNode)}
        {selectedId === node.id && <span className="resize-handle" aria-hidden="true" onPointerDown={(event) => onResizePointerDown(event, node)} />}
      </div>
    );
    if (node.type === "text") return (
      <button key={node.id} type="button" className={`canvas-text${selectedId === node.id ? " is-selected" : ""}`}
        aria-label={node.name} aria-pressed={selectedId === node.id}
        style={{ ...style, fontSize: node.fontSize, color: node.color, textAlign: node.textAlign }}
        onPointerDown={(event) => onNodePointerDown(event, node)} onPointerMove={onNodePointerMove}
        onPointerUp={(event) => onNodePointerUp(event.pointerId)}
        onPointerCancel={(event) => onNodePointerUp(event.pointerId)}
        onLostPointerCapture={(event) => onNodePointerUp(event.pointerId)}>
        {node.content}
        {selectedId === node.id && <span className="resize-handle" aria-hidden="true" onPointerDown={(event) => onResizePointerDown(event, node)} />}
      </button>
    );
    if (node.type === "image") return (
      <button key={node.id} type="button"
        className={`canvas-image${selectedId === node.id ? " is-selected" : ""}`}
        aria-label={node.name} aria-pressed={selectedId === node.id} style={style}
        onPointerDown={(event) => onNodePointerDown(event, node)} onPointerMove={onNodePointerMove}
        onPointerUp={(event) => onNodePointerUp(event.pointerId)}
        onPointerCancel={(event) => onNodePointerUp(event.pointerId)}
        onLostPointerCapture={(event) => onNodePointerUp(event.pointerId)}>
        <img src={node.source} alt="" draggable={false} onError={() => onImageError(node.id)} />
        {selectedId === node.id && <span className="resize-handle" aria-hidden="true" onPointerDown={(event) => onResizePointerDown(event, node)} />}
      </button>
    );
    return (
      <button key={node.id} type="button"
        className={`canvas-node${node.type === "ellipse" ? " canvas-ellipse" : ""}${selectedId === node.id ? " is-selected" : ""}`}
        aria-label={node.name} aria-pressed={selectedId === node.id}
        style={{ ...style, background: node.fill, borderColor: node.stroke, borderWidth: node.strokeWidth, borderRadius: node.type === "ellipse" ? "50%" : node.cornerRadius }}
        onPointerDown={(event) => onNodePointerDown(event, node)} onPointerMove={onNodePointerMove}
        onPointerUp={(event) => onNodePointerUp(event.pointerId)}
        onPointerCancel={(event) => onNodePointerUp(event.pointerId)}
        onLostPointerCapture={(event) => onNodePointerUp(event.pointerId)}>
        {selectedId === node.id && <span className="resize-handle" aria-hidden="true" onPointerDown={(event) => onResizePointerDown(event, node)} />}
      </button>
    );
  }

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
          {design.children.map(renderNode)}
          {drawing && (() => {
            const geometry = drawingGeometry(drawing.start, drawing.end, drawing.parentOrigin);
            return <div className={`draw-preview${drawing.tool === "ellipse" ? " is-ellipse" : ""}`}
              style={{ left: geometry.x + drawing.parentOrigin.x, top: geometry.y + drawing.parentOrigin.y, width: geometry.width, height: geometry.height }} />;
          })()}
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
