import type { PointerEvent } from "react";
import type { DocumentNode } from "@/document/types";
import { ResizeHandle } from "@/pages/editor/components/atoms/ResizeHandle";

export interface NodeInteraction {
  onNodePointerDown(event: PointerEvent<HTMLElement>, node: DocumentNode): void;
  onResizePointerDown(event: PointerEvent<HTMLSpanElement>, node: DocumentNode): void;
  onNodePointerMove(event: PointerEvent<HTMLElement>): void;
  onNodePointerUp(pointerId: number): void;
  onImageError(id: string): void;
}

interface CanvasNodeProps {
  node: DocumentNode;
  selectedId: string | null;
  interaction: NodeInteraction;
}

export function CanvasNode({ node, selectedId, interaction }: CanvasNodeProps) {
  const {
    onNodePointerDown, onResizePointerDown, onNodePointerMove, onNodePointerUp, onImageError,
  } = interaction;
  const style = { left: node.x, top: node.y, width: node.width, height: node.height };
  const handle = selectedId === node.id && <ResizeHandle onPointerDown={(event) => onResizePointerDown(event, node)} />;
  const pointerEvents = {
    onPointerMove: onNodePointerMove,
    onPointerUp: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
  };

  if (node.type === "frame") return (
    <div className={`canvas-frame${selectedId === node.id ? " is-selected" : ""}`}
      data-frame-id={node.id} role="group" aria-label={node.name} style={style}
      onPointerDown={(event) => { if (event.target === event.currentTarget) onNodePointerDown(event, node); }}
      {...pointerEvents}>
      {node.children.map((child) => <CanvasNode key={child.id} node={child} selectedId={selectedId} interaction={interaction} />)}
      {handle}
    </div>
  );
  if (node.type === "text") return (
    <button type="button" className={`canvas-text${selectedId === node.id ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedId === node.id}
      style={{ ...style, fontSize: node.fontSize, color: node.color, textAlign: node.textAlign }}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {node.content}
      {handle}
    </button>
  );
  if (node.type === "image") return (
    <button type="button" className={`canvas-image${selectedId === node.id ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedId === node.id} style={style}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      <img src={node.source} alt="" draggable={false} onError={() => onImageError(node.id)} />
      {handle}
    </button>
  );
  return (
    <button type="button"
      className={`canvas-node${node.type === "ellipse" ? " canvas-ellipse" : ""}${selectedId === node.id ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedId === node.id}
      style={{ ...style, background: node.fill, borderColor: node.stroke, borderWidth: node.strokeWidth, borderRadius: node.type === "ellipse" ? "50%" : node.cornerRadius }}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {handle}
    </button>
  );
}
