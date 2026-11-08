import { type PointerEvent, useMemo } from "react";

import { RENDER_COLORS } from "@/rendering/colors";
import { ResizeHandle } from "@/pages/editor/components/atoms/ResizeHandle";
import { resolvedTextFont } from "@/document/textFonts";
import { DEFAULT_TEXT_LETTER_SPACING, DEFAULT_TEXT_LINE_HEIGHT, type DocumentNode, type TextNode } from "@/document/types";
import { layoutTextLines, textFragmentStyle, type TextLine } from "@/rendering/textLayout";

let measurementContext: CanvasRenderingContext2D | null = null;

function visibleTextLines(node: TextNode): TextLine[] {
  const content = node.content.replace(/\r\n?/g, "\n");
  const fallback = () => content.split("\n").map((text) => ({ fragments: text ? [{ text, mark: null, width: 0 }] : [], width: 0 }));
  if (typeof document === "undefined") return fallback();
  measurementContext ??= document.createElement("canvas").getContext("2d");
  return measurementContext ? layoutTextLines(measurementContext, node).lines : fallback();
}

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
  selectedIds?: string[];
  interaction: NodeInteraction;
}

export function CanvasNode({ node, selectedId, selectedIds = selectedId ? [selectedId] : [], interaction }: CanvasNodeProps) {
  const {
    onNodePointerDown, onResizePointerDown, onNodePointerMove, onNodePointerUp, onImageError,
  } = interaction;
  const style = { left: node.x, top: node.y, width: node.width, height: node.height };
  const lines = useMemo(() => node.type === "text" ? visibleTextLines(node) : null, [node]);
  const handle = selectedId === node.id && <ResizeHandle onPointerDown={(event) => onResizePointerDown(event, node)} />;
  const pointerEvents = {
    onPointerMove: onNodePointerMove,
    onPointerUp: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
  };

  if (node.type === "frame") return (
    <div className={`canvas-frame${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      data-frame-id={node.id} role="group" aria-label={node.name} style={{ ...style, background: node.background }}
      onPointerDown={(event) => { if (event.target === event.currentTarget) onNodePointerDown(event, node); }}
      {...pointerEvents}>
      <div className="frame-contents" style={{ overflow: node.clipContent ? "hidden" : "visible" }}>
        {node.children.map((child) => <CanvasNode key={child.id} node={child} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} />)}
      </div>
      {handle}
    </div>
  );
  if (node.type === "text") return (
    <button type="button" className={`canvas-text${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)}
      style={{ ...style, fontSize: node.fontSize, color: node.color, textAlign: node.textAlign,
        lineHeight: node.lineHeight ?? DEFAULT_TEXT_LINE_HEIGHT, letterSpacing: `${node.letterSpacing ?? DEFAULT_TEXT_LETTER_SPACING}px`, ...resolvedTextFont(node) }}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {lines?.map((line, index) => <span key={index} className="canvas-text-line"
        style={{ height: node.fontSize * (node.lineHeight ?? DEFAULT_TEXT_LINE_HEIGHT) }}>
        {line.fragments.map((fragment, part) => {
          if (!fragment.mark) return fragment.text;
          const appearance = textFragmentStyle(node, fragment.mark);
          return <span key={part} style={{ fontFamily: appearance.fontFamily, fontWeight: appearance.fontWeight,
            color: appearance.color, textDecorationLine: appearance.underline ? "underline" : undefined,
            backgroundColor: appearance.code ? RENDER_COLORS.codeBackground : undefined, borderRadius: appearance.code ? 3 : undefined }}>{fragment.text}</span>;
        })}
      </span>)}
      {handle}
    </button>
  );
  if (node.type === "image") return (
    <button type="button" className={`canvas-image${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)} style={style}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      <img src={node.source} alt="" draggable={false} onError={() => onImageError(node.id)} />
      {handle}
    </button>
  );
  return (
    <button type="button"
      className={`canvas-node${node.type === "ellipse" ? " canvas-ellipse" : ""}${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)}
      style={{ ...style, background: node.fill, borderColor: node.stroke, borderWidth: node.strokeWidth, borderRadius: node.type === "ellipse" ? "50%" : node.cornerRadius }}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {handle}
    </button>
  );
}
