import { Fragment, type PointerEvent, type ReactNode, useId, useMemo } from "react";

import type { PathPointPart } from "@/document/pathEdit.ts";
import { ResizeHandle } from "@/pages/editor/components/atoms/ResizeHandle";
import type { Border, DocumentNode, PathNode, TextNode } from "@/document/types";
import { borderPaths, boxShape, ellipseShape, pathToString, roundedRectPath, type ShapePaths, vectorShape } from "@/document/shapePath.ts";
import { frameContentsStyle, frameNodeStyle, imageContentStyle, imageNodeStyle, shapeNodeStyle, textLineStyle, textMarkStyle, textNodeStyle } from "@/pages/editor/canvasStyles";
import { layoutTextLines, type TextLine } from "@/rendering/textLayout";
import { maskGroups, maskPath } from "@/document/masks.ts";

let measurementContext: CanvasRenderingContext2D | null = null;

function shapeSvg(shape: ShapePaths, gradientId: string, width: number, height: number) {
  const fill = shape.fillColor;
  const stops = fill && typeof fill !== "string" && fill.stops.map((stop, index) =>
    <stop key={index} offset={stop.position} stopColor={stop.color} />);
  return (
    <svg className="canvas-shape" aria-hidden="true">
      {fill && typeof fill !== "string" && <defs>{fill.type === "linear"
        ? <linearGradient id={gradientId} x1={fill.start.x * width} y1={fill.start.y * height} x2={fill.end.x * width} y2={fill.end.y * height} gradientUnits="userSpaceOnUse">{stops}</linearGradient>
        : <radialGradient id={gradientId} cx={fill.center.x * width} cy={fill.center.y * height}
          r={fill.radius * Math.min(width, height)} gradientUnits="userSpaceOnUse">{stops}</radialGradient>}
      </defs>}
      <path d={pathToString(shape.fill)} fill={typeof fill === "string" ? fill : fill ? `url(#${gradientId})` : "none"} fillRule={shape.fillRule} />
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
  onNodeEnter?(id: string): void;
  onNodeLeave?(id: string): void;
  onNodeClick?(id: string): void;
  onPathPointPointerDown?(event: PointerEvent<SVGCircleElement>, node: PathNode, index: number, part: PathPointPart): void;
  onPathPointPointerMove?(event: PointerEvent<SVGCircleElement>): void;
  onPathPointPointerUp?(pointerId: number): void;
  onPathPointPointerCancel?(): void;
}

interface CanvasNodeProps {
  node: DocumentNode;
  selectedId: string | null;
  selectedIds?: string[];
  interaction: NodeInteraction;
  zoom?: number;
}

function pathControls(node: PathNode, zoom: number, interaction: NodeInteraction) {
  if (!interaction.onPathPointPointerDown) return null;
  const controls: ReactNode[] = [];
  let previous: { x: number; y: number } | null = null;
  node.commands.forEach((command, index) => {
    if (command.kind === "close") return;
    const handler = (part: PathPointPart) => ({
      onPointerDown: (event: PointerEvent<SVGCircleElement>) => interaction.onPathPointPointerDown?.(event, node, index, part),
      onPointerMove: interaction.onPathPointPointerMove,
      onPointerUp: (event: PointerEvent<SVGCircleElement>) => interaction.onPathPointPointerUp?.(event.pointerId),
      onPointerCancel: interaction.onPathPointPointerCancel,
      onLostPointerCapture: interaction.onPathPointPointerCancel,
    });
    const x = command.x * node.width;
    const y = command.y * node.height;
    if (command.kind === "cubic" && previous) {
      const x1 = command.x1 * node.width;
      const y1 = command.y1 * node.height;
      const x2 = command.x2 * node.width;
      const y2 = command.y2 * node.height;
      controls.push(<g key={`handles-${index}`} className="path-handles">
        <line x1={previous.x * node.width} y1={previous.y * node.height} x2={x1} y2={y1} />
        <line x1={x2} y1={y2} x2={x} y2={y} />
        <circle data-path-control={`in-${index}`} cx={x1} cy={y1} r={4 / zoom} {...handler("in")} />
        <circle data-path-control={`out-${index}`} cx={x2} cy={y2} r={4 / zoom} {...handler("out")} />
      </g>);
    }
    controls.push(<circle key={`anchor-${index}`} className="path-anchor" data-path-control={`anchor-${index}`}
      cx={x} cy={y} r={5 / zoom} {...handler("anchor")} />);
    previous = command;
  });
  return <svg className="path-controls" aria-label="パスの点とハンドル" style={{ left: node.x, top: node.y, width: node.width, height: node.height,
    ...(node.rotation ? { transform: `rotate(${node.rotation}deg)`, transformOrigin: "center center" } : {}) }}>
    {controls}
  </svg>;
}

export function CanvasNodes({ nodes, selectedId, selectedIds = selectedId ? [selectedId] : [], interaction, zoom = 1 }: { nodes: DocumentNode[] } & Omit<CanvasNodeProps, "node">) {
  return <>{maskGroups(nodes).map((group, index) => <Fragment key={group.mask?.id ?? `unmasked-${index}`}>
    {group.mask && <CanvasNode node={group.mask} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} zoom={zoom} />}
    {group.mask ? <div className="canvas-mask-group" style={{ clipPath: `path("${pathToString(maskPath(group.mask))}")` }}>
      {group.children.map((child) => <CanvasNode key={child.id} node={child} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} zoom={zoom} />)}
    </div> : group.children.map((child) => <CanvasNode key={child.id} node={child} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} zoom={zoom} />)}
  </Fragment>)}</>;
}

export function CanvasNode({ node, selectedId, selectedIds = selectedId ? [selectedId] : [], interaction, zoom = 1 }: CanvasNodeProps) {
  const { onNodePointerDown, onResizePointerDown, onNodePointerMove, onNodePointerUp, onImageError } = interaction;
  const lines = useMemo(() => node.type === "text" ? visibleTextLines(node) : null, [node]);
  const clipId = useId();
  const handle = selectedId === node.id && <ResizeHandle onPointerDown={(event) => onResizePointerDown(event, node)} />;
  const pointerEvents = {
    onPointerMove: onNodePointerMove,
    onPointerUp: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => onNodePointerUp(event.pointerId),
    onPointerEnter: interaction.onNodeEnter ? () => interaction.onNodeEnter?.(node.id) : undefined,
    onPointerLeave: interaction.onNodeLeave ? () => interaction.onNodeLeave?.(node.id) : undefined,
    onClick: interaction.onNodeClick ? (event: { stopPropagation(): void }) => { event.stopPropagation(); interaction.onNodeClick?.(node.id); } : undefined,
  };

  if (node.type === "frame") return (
    <div className={`canvas-frame${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      data-frame-id={node.id} role="group" aria-label={node.name} style={frameNodeStyle(node)}
      onPointerDown={(event) => { if (event.target === event.currentTarget) onNodePointerDown(event, node); }}
      {...pointerEvents}>
       {shapeSvg(boxShape(node.width, node.height, node.style), clipId, node.width, node.height)}
      <div className="frame-contents" style={frameContentsStyle(node)}>
        <CanvasNodes nodes={node.children} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} zoom={zoom} />
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
  if (node.type === "path") return <Fragment>
    <button type="button" className={`canvas-node${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)} style={shapeNodeStyle(node)}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {shapeSvg(vectorShape(node), clipId, node.width, node.height)}
      {handle}
    </button>
    {selectedId === node.id && pathControls(node, zoom, interaction)}
  </Fragment>;
  if (node.type === "instance") return null;
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
        : shapeSvg(node.type === "rectangle" ? boxShape(node.width, node.height, node.style) : ellipseShape(node.width, node.height, node.style), clipId, node.width, node.height)}
      {node.type === "rectangle" && !node.isMask && borderSvg(node.width, node.height, node.style.border)}
      {handle}
    </button>
  );
}
