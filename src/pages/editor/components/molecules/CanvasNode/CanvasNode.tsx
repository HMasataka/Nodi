import { Fragment, type PointerEvent, type ReactNode, useId, useMemo } from "react";

import type { PathPointPart } from "@/document/pathEdit.ts";
import { ResizeHandle } from "@/pages/editor/components/atoms/ResizeHandle";
import { useColorResolver } from "@/pages/editor/colorContext.ts";
import type { Border, Color, DocumentNode, PathNode, TextNode } from "@/document/types";
import { borderPaths, boxShape, ellipseShape, pathToString, roundedRectPath, type ShapePaths, vectorShape } from "@/document/shapePath.ts";
import { frameContentsStyle, frameNodeStyle, imageContentStyle, imageNodeStyle, shapeNodeStyle, textLineStyle, textMarkStyle, textNodeStyle } from "@/pages/editor/canvasStyles";
import { layoutTextLines, type TextLine } from "@/rendering/textLayout";
import { maskGroups, maskPath } from "@/document/masks.ts";

import { RESIZE_CORNERS, type ResizeCorner } from "@/pages/editor/geometry";

// 寸法の札の文言。小数は四捨五入して整数で出す。
export function sizeLabel(width: number, height: number): string {
  return `${Math.round(width)} × ${Math.round(height)}`;
}

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

function borderSvg(width: number, height: number, border: Border, resolve: (color: Color) => string) {
  const paths = borderPaths(width, height, border, resolve);
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
  onResizePointerDown(event: PointerEvent<HTMLSpanElement>, node: DocumentNode, corner: ResizeCorner): void;
  onNodePointerMove(event: PointerEvent<HTMLElement>): void;
  onNodePointerUp(pointerId: number): void;
  onImageError(id: string): void;
  onNodeEnter?(id: string): void;
  onNodeLeave?(id: string): void;
  onNodeClick?(id: string): void;
  onPathPointPointerDown?(event: PointerEvent<SVGElement>, node: PathNode, index: number, part: PathPointPart): void;
  onPathPointPointerMove?(event: PointerEvent<SVGElement>): void;
  onPathPointPointerUp?(pointerId: number): void;
  onPathPointPointerCancel?(): void;
  // 選んでいるパスの点。点を選ぶと、その点だけを紫で塗り、その点のハンドルだけを出す。
  selectedPathPoint?: { nodeId: string; index: number } | null;
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
  const selected = interaction.selectedPathPoint?.nodeId === node.id ? interaction.selectedPathPoint.index : null;
  const handles: ReactNode[] = [];
  const anchors: ReactNode[] = [];
  let previous: { x: number; y: number; index: number } | null = null;
  node.commands.forEach((command, index) => {
    if (command.kind === "close") return;
    const handler = (part: PathPointPart) => ({
      onPointerDown: (event: PointerEvent<SVGElement>) => interaction.onPathPointPointerDown?.(event, node, index, part),
      onPointerMove: interaction.onPathPointPointerMove,
      onPointerUp: (event: PointerEvent<SVGElement>) => interaction.onPathPointPointerUp?.(event.pointerId),
      onPointerCancel: interaction.onPathPointPointerCancel,
      onLostPointerCapture: interaction.onPathPointPointerCancel,
    });
    const x = command.x * node.width;
    const y = command.y * node.height;
    // ハンドルは細い線の先に 6px の丸を付ける。点を選んでいるときは、その点に付くハンドルだけを出す。
    const bezierHandle = (key: string, part: PathPointPart, from: { x: number; y: number }, to: { x: number; y: number }) =>
      <g key={key} className="path-handle">
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={1 / zoom} />
        <circle data-path-control={key} cx={to.x} cy={to.y} r={3 / zoom} strokeWidth={1 / zoom} {...handler(part)} />
      </g>;
    if (command.kind === "cubic" && previous) {
      if (selected === null || selected === previous.index) {
        handles.push(bezierHandle(`in-${index}`, "in", { x: previous.x * node.width, y: previous.y * node.height },
          { x: command.x1 * node.width, y: command.y1 * node.height }));
      }
      if (selected === null || selected === index) {
        handles.push(bezierHandle(`out-${index}`, "out", { x, y }, { x: command.x2 * node.width, y: command.y2 * node.height }));
      }
    }
    // 点は白地に紫の枠の 8px 角にし、選んだ点だけ紫で塗る。
    anchors.push(<rect key={`anchor-${index}`} className={`path-anchor${selected === index ? " is-selected" : ""}`}
      data-path-control={`anchor-${index}`} x={x - 4 / zoom} y={y - 4 / zoom} width={8 / zoom} height={8 / zoom} strokeWidth={1 / zoom}
      {...handler("anchor")} />);
    previous = { x: command.x, y: command.y, index };
  });
  return <svg className="path-controls" aria-label="パスの点とハンドル" style={{ left: node.x, top: node.y, width: node.width, height: node.height,
    ...(node.rotation ? { transform: `rotate(${node.rotation}deg)`, transformOrigin: "center center" } : {}) }}>
    {handles}
    {anchors}
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
  const resolve = useColorResolver();
  const { onNodePointerDown, onResizePointerDown, onNodePointerMove, onNodePointerUp, onImageError } = interaction;
  const lines = useMemo(() => node.type === "text" ? visibleTextLines(node) : null, [node]);
  const clipId = useId();
  // 1つだけ選んでいるときに、四隅のつまみと寸法の札を出す。
  const handle = selectedId === node.id && selectedIds.length === 1 && <>
    {RESIZE_CORNERS.map((corner) => <ResizeHandle key={`${corner.x}${corner.y}`} corner={corner}
      onPointerDown={(event) => onResizePointerDown(event, node, corner)} />)}
    <span className="canvas-size-label" aria-hidden="true">{sizeLabel(node.width, node.height)}</span>
  </>;
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
      data-frame-id={node.id} role="group" aria-label={node.name} style={frameNodeStyle(node, resolve)}
      onPointerDown={(event) => { if (event.target === event.currentTarget) onNodePointerDown(event, node); }}
      {...pointerEvents}>
       {shapeSvg(boxShape(node.width, node.height, node.style, resolve), clipId, node.width, node.height)}
      <div className="frame-contents" style={frameContentsStyle(node)}>
        <CanvasNodes nodes={node.children} selectedId={selectedId} selectedIds={selectedIds} interaction={interaction} zoom={zoom} />
      </div>
      {borderSvg(node.width, node.height, node.style.border, resolve)}
      {handle}
    </div>
  );
  if (node.type === "text") return (
    <button type="button" className={`canvas-text${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)}
      style={textNodeStyle(node, resolve)}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {lines?.map((line, index) => <span key={index} className="canvas-text-line"
        style={textLineStyle(node)}>
        {line.fragments.map((fragment, part) => {
          if (!fragment.mark) return fragment.text;
          return <span key={part} style={textMarkStyle(node, fragment.mark, resolve)}>{fragment.text}</span>;
        })}
      </span>)}
      {handle}
    </button>
  );
  if (node.type === "image") return (
    <button type="button" className={`canvas-image${selectedIds.includes(node.id) ? " is-selected" : ""}`}
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)} style={imageNodeStyle(node, resolve)}
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
      aria-label={node.name} aria-pressed={selectedIds.includes(node.id)} style={shapeNodeStyle(node, resolve)}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {shapeSvg(vectorShape(node, resolve), clipId, node.width, node.height)}
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
      style={shapeNodeStyle(node, resolve)}
      onPointerDown={(event) => onNodePointerDown(event, node)} {...pointerEvents}>
      {node.isMask
        ? <svg className="canvas-shape" aria-hidden="true"><path d={pathToString(node.type === "rectangle"
          ? boxShape(node.width, node.height, node.style, resolve).fill : ellipseShape(node.width, node.height, node.style, resolve).fill)}
          fill="none" stroke="currentColor" strokeDasharray="4 3" /></svg>
        : shapeSvg(node.type === "rectangle" ? boxShape(node.width, node.height, node.style, resolve) : ellipseShape(node.width, node.height, node.style, resolve), clipId, node.width, node.height)}
      {node.type === "rectangle" && !node.isMask && borderSvg(node.width, node.height, node.style.border, resolve)}
      {handle}
    </button>
  );
}
