import { Fragment, type PointerEvent, useId, useMemo } from "react";

import { ResizeHandle } from "@/pages/editor/components/atoms/ResizeHandle";
import type { Border, DocumentNode, TextNode } from "@/document/types";
import { borderPaths, boxShape, ellipseShape, pathToString, roundedRectPath, type ShapePaths } from "@/document/shapePath.ts";
import { frameContentsStyle, frameNodeStyle, imageContentStyle, imageNodeStyle, shapeNodeStyle, textLineStyle, textMarkStyle, textNodeStyle } from "@/pages/editor/canvasStyles";
import { layoutTextLines, type TextLine } from "@/rendering/textLayout";
import { maskGroups, maskPath } from "@/document/masks.ts";

let measurementContext: CanvasRenderingContext2D | null = null;

function shapeSvg(shape: ShapePaths, gradientId: string) {
  const fill = shape.fillColor;
  return (
    <svg className="canvas-shape" aria-hidden="true">
      {fill && typeof fill !== "string" && <defs><linearGradient id={gradientId} x1={fill.start.x} y1={fill.start.y}
        x2={fill.end.x} y2={fill.end.y} gradientUnits="objectBoundingBox">
        {fill.stops.map((stop, index) => <stop key={index} offset={stop.position} stopColor={stop.color} />)}
      </linearGradient></defs>}
      <path d={pathToString(shape.fill)} fill={typeof fill === "string" ? fill : fill ? `url(#${gradientId})` : "none"} />
      {shape.stroke && <path d={pathToString(shape.stroke)} fill="none" stroke={shape.strokeColor} strokeWidth={shape.strokeWidth} />}
    </svg>
  );
}

function borderSvg(width: number, height: number, border: Border) {
  const paths = borderPaths(width, height, border);
  return paths.length > 0 && <svg className="canvas-shape canvas-border" aria-hidden="true">
    {paths.map((edge) => <path key={edge.side} d={pathToString(edge.commands)} fill={edge.color} />)}
  </svg>;
}

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

export function CanvasNodes({ nodes, selectedId, selectedIds = selectedId ? [selectedId] : [], interaction }: { nodes: DocumentNode[] } & Omit<CanvasNodeProps, "node">) {
  return <>{maskGroups(nodes).map((group, index) => <Fragment key={group.mask?.id ?? `unmasked-${index}`}>
    {group.mask && <CanvasNode node={group.mask} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} />}
    {group.mask ? <div className="canvas-mask-group" style={{ clipPath: `path("${pathToString(maskPath(group.mask))}")` }}>
      {group.children.map((child) => <CanvasNode key={child.id} node={child} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} />)}
    </div> : group.children.map((child) => <CanvasNode key={child.id} node={child} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} />)}
  </Fragment>)}</>;
}

export function CanvasNode({ node, selectedId, selectedIds = selectedId ? [selectedId] : [], interaction }: CanvasNodeProps) {
  const { onNodePointerDown, onResizePointerDown, onNodePointerMove, onNodePointerUp, onImageError } = interaction;
  const lines = useMemo(() => node.type === "text" ? visibleTextLines(node) : null, [node]);
  const clipId = useId();
  const handle = selectedId === node.id && <ResizeHandle onPointerDown={(event) => onResizePointerDown(event, node)} />;
  const pointerEvents = {
    onPointerMove: onNodePointerMove,
    onPointerUp: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
  };

  if (node.type === "frame") return (
    <div className={`canvas-frame${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      data-frame-id={node.id} role="group" aria-label={node.name} style={frameNodeStyle(node)}
      onPointerDown={(event) => { if (event.target === event.currentTarget) onNodePointerDown(event, node); }}
      {...pointerEvents}>
       {shapeSvg(boxShape(node.width, node.height, node.style), clipId)}
      <div className="frame-contents" style={frameContentsStyle(node)}>
        <CanvasNodes nodes={node.children} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} />
      </div>
      {borderSvg(node.width, node.height, node.style.border)}
      {handle}
    </div>
  );
  if (node.type === "text") return (
    <button type="button" className={`canvas-text${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)}
      style={textNodeStyle(node)}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {lines?.map((line, index) => <span key={index} className="canvas-text-line"
        style={textLineStyle(node)}>
        {line.fragments.map((fragment, part) => {
          if (!fragment.mark) return fragment.text;
          return <span key={part} style={textMarkStyle(node, fragment.mark)}>{fragment.text}</span>;
        })}
      </span>)}
      {handle}
    </button>
  );
  if (node.type === "image") return (
    <button type="button" className={`canvas-image${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)} style={imageNodeStyle(node)}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      <svg viewBox={`0 0 ${node.width} ${node.height}`} aria-hidden="true">
        <defs><clipPath id={clipId}><path d={pathToString(roundedRectPath(0, 0, node.width, node.height, node.style.cornerRadii))} /></clipPath></defs>
        <foreignObject width={node.width} height={node.height} clipPath={`url(#${clipId})`}>
          <img src={node.source} alt="" draggable={false} style={imageContentStyle(node)} onError={() => onImageError(node.id)} />
        </foreignObject>
      </svg>
      {handle}
    </button>
  );
  if (node.isMask && !selectedIds.includes(node.id)) return null;
  return (
    <button type="button"
      className={`canvas-node${node.isMask ? " canvas-mask is-selected" : selectedIds.includes(node.id) ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)}
      style={shapeNodeStyle(node)}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {node.isMask
        ? <svg className="canvas-shape" aria-hidden="true"><path d={pathToString(node.type === "rectangle"
          ? boxShape(node.width, node.height, node.style).fill : ellipseShape(node.width, node.height, node.style).fill)}
          fill="none" stroke="currentColor" strokeDasharray="4 3" /></svg>
        : shapeSvg(node.type === "rectangle" ? boxShape(node.width, node.height, node.style) : ellipseShape(node.width, node.height, node.style), clipId)}
      {node.type === "rectangle" && !node.isMask && borderSvg(node.width, node.height, node.style.border)}
      {handle}
    </button>
  );
}
