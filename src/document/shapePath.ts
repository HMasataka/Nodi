import type { Border, BoxStyle, Color, CornerRadii, Fill, PathNode, ShapeStyle } from "@/document/types.ts";
import { type Transform, transformPoint } from "@/document/transform.ts";

export type PathCommand =
  | { kind: "move"; x: number; y: number }
  | { kind: "line"; x: number; y: number }
  | { kind: "cubic"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { kind: "arc"; cx: number; cy: number; rx: number; ry: number; startAngle: number; endAngle: number; counterclockwise: boolean; rotation?: number }
  | { kind: "close" };

const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

export function normalizeRadii(radii: CornerRadii, width: number, height: number): CornerRadii {
  const { topLeft, topRight, bottomRight, bottomLeft } = radii;
  const ratio = (size: number, sum: number) => sum > 0 ? size / sum : 1;
  const factor = Math.min(1, ratio(width, topLeft + topRight), ratio(width, bottomLeft + bottomRight),
    ratio(height, topLeft + bottomLeft), ratio(height, topRight + bottomRight));
  return { topLeft: topLeft * factor, topRight: topRight * factor, bottomRight: bottomRight * factor, bottomLeft: bottomLeft * factor };
}

export function roundedRectPath(x: number, y: number, width: number, height: number, radii: CornerRadii): PathCommand[] {
  const { topLeft, topRight, bottomRight, bottomLeft } = normalizeRadii(radii, width, height);
  const right = x + width;
  const bottom = y + height;
  const commands: PathCommand[] = [
    { kind: "move", x: x + topLeft, y },
    { kind: "line", x: right - topRight, y },
  ];
  if (topRight > 0) commands.push({ kind: "arc", cx: right - topRight, cy: y + topRight, rx: topRight, ry: topRight, startAngle: -QUARTER_TURN, endAngle: 0, counterclockwise: false });
  commands.push({ kind: "line", x: right, y: bottom - bottomRight });
  if (bottomRight > 0) commands.push({ kind: "arc", cx: right - bottomRight, cy: bottom - bottomRight, rx: bottomRight, ry: bottomRight, startAngle: 0, endAngle: QUARTER_TURN, counterclockwise: false });
  commands.push({ kind: "line", x: x + bottomLeft, y: bottom });
  if (bottomLeft > 0) commands.push({ kind: "arc", cx: x + bottomLeft, cy: bottom - bottomLeft, rx: bottomLeft, ry: bottomLeft, startAngle: QUARTER_TURN, endAngle: HALF_TURN, counterclockwise: false });
  commands.push({ kind: "line", x, y: y + topLeft });
  if (topLeft > 0) commands.push({ kind: "arc", cx: x + topLeft, cy: y + topLeft, rx: topLeft, ry: topLeft, startAngle: HALF_TURN, endAngle: HALF_TURN + QUARTER_TURN, counterclockwise: false });
  commands.push({ kind: "close" });
  return commands;
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): PathCommand[] {
  return [
    { kind: "move", x: cx + rx, y: cy },
    { kind: "arc", cx, cy, rx, ry, startAngle: 0, endAngle: HALF_TURN, counterclockwise: false },
    { kind: "arc", cx, cy, rx, ry, startAngle: HALF_TURN, endAngle: FULL_TURN, counterclockwise: false },
    { kind: "close" },
  ];
}

export function transformPath(commands: PathCommand[], transform: Transform): PathCommand[] {
  const angle = Math.atan2(transform.b, transform.a);
  return commands.map((command) => {
    if (command.kind === "close") return command;
    if (command.kind === "arc") {
      const center = transformPoint(transform, { x: command.cx, y: command.cy });
      return { ...command, cx: center.x, cy: center.y, rotation: (command.rotation ?? 0) + angle };
    }
    if (command.kind === "cubic") {
      const first = transformPoint(transform, { x: command.x1, y: command.y1 });
      const second = transformPoint(transform, { x: command.x2, y: command.y2 });
      return { ...command, ...transformPoint(transform, command), x1: first.x, y1: first.y, x2: second.x, y2: second.y };
    }
    return { ...command, ...transformPoint(transform, command) };
  });
}

function insetRadii(radii: CornerRadii, inset: number): CornerRadii {
  return {
    topLeft: Math.max(0, radii.topLeft - inset),
    topRight: Math.max(0, radii.topRight - inset),
    bottomRight: Math.max(0, radii.bottomRight - inset),
    bottomLeft: Math.max(0, radii.bottomLeft - inset),
  };
}

export interface ResolvedFillStop { position: number; color: string }
export interface ResolvedLinearFill { type: "linear"; start: { x: number; y: number }; end: { x: number; y: number }; stops: ResolvedFillStop[] }
export interface ResolvedRadialFill { type: "radial"; center: { x: number; y: number }; radius: number; stops: ResolvedFillStop[] }
export type ResolvedFill = string | ResolvedLinearFill | ResolvedRadialFill | null;

export type ColorResolver = (color: Color) => string;

export function resolveFill(fill: Fill, resolve: ColorResolver): ResolvedFill {
  if (fill === null) return null;
  if (typeof fill === "string" || fill.type === "palette") return resolve(fill);
  if (fill.type === "linear") {
    return { type: "linear", start: fill.start, end: fill.end, stops: fill.stops.map((stop) => ({ position: stop.position, color: resolve(stop.color) })) };
  }
  return { type: "radial", center: fill.center, radius: fill.radius, stops: fill.stops.map((stop) => ({ position: stop.position, color: resolve(stop.color) })) };
}

export interface ShapePaths {
  fill: PathCommand[];
  fillColor: ResolvedFill;
  stroke: PathCommand[] | null;
  strokeColor: string;
  strokeWidth: number;
  fillRule?: "nonzero" | "evenodd";
}

export function vectorShape(node: PathNode, resolve: ColorResolver): ShapePaths {
  const commands: PathCommand[] = node.commands.map((command) => command.kind === "close" ? command : command.kind === "cubic"
    ? { kind: "cubic", x: command.x * node.width, y: command.y * node.height,
      x1: command.x1 * node.width, y1: command.y1 * node.height, x2: command.x2 * node.width, y2: command.y2 * node.height }
    : { kind: command.kind, x: command.x * node.width, y: command.y * node.height });
  return { fill: commands, fillColor: resolveFill(node.style.fill, resolve), stroke: node.style.stroke?.width ? commands : null,
    strokeColor: resolve(node.style.stroke?.color ?? "#000000"), strokeWidth: node.style.stroke?.width ?? 0, fillRule: node.fillRule };
}

export interface BorderPath { side: keyof Border; color: string; commands: PathCommand[] }

export function borderPaths(width: number, height: number, border: Border, resolve: ColorResolver): BorderPath[] {
  const top = Math.min(border.top?.width ?? 0, height);
  const right = Math.min(border.right?.width ?? 0, width);
  const bottom = Math.min(border.bottom?.width ?? 0, height);
  const left = Math.min(border.left?.width ?? 0, width);
  const horizontalScale = left + right > width ? width / (left + right) : 1;
  const verticalScale = top + bottom > height ? height / (top + bottom) : 1;
  const innerLeft = left * horizontalScale;
  const innerRight = width - right * horizontalScale;
  const innerTop = top * verticalScale;
  const innerBottom = height - bottom * verticalScale;
  const corners = {
    top: [[0, 0], [width, 0], [innerRight, innerTop], [innerLeft, innerTop]],
    right: [[width, 0], [width, height], [innerRight, innerBottom], [innerRight, innerTop]],
    bottom: [[width, height], [0, height], [innerLeft, innerBottom], [innerRight, innerBottom]],
    left: [[0, height], [0, 0], [innerLeft, innerTop], [innerLeft, innerBottom]],
  };
  return (["top", "right", "bottom", "left"] as const).flatMap((side) => {
    const edge = border[side];
    if (!edge || edge.width === 0) return [];
    const [first, ...rest] = corners[side];
    return [{ side, color: resolve(edge.color), commands: [
      { kind: "move" as const, x: first[0], y: first[1] },
      ...rest.map(([x, y]) => ({ kind: "line" as const, x, y })),
      { kind: "close" as const },
    ] }];
  });
}

export function boxShape(width: number, height: number, style: BoxStyle, resolve: ColorResolver): ShapePaths {
  const strokeWidth = Math.min(style.stroke?.width ?? 0, width, height);
  const inset = strokeWidth / 2;
  return {
    fill: roundedRectPath(0, 0, width, height, style.cornerRadii),
    fillColor: resolveFill(style.fill, resolve),
    stroke: style.stroke && strokeWidth > 0
      ? roundedRectPath(inset, inset, width - strokeWidth, height - strokeWidth, insetRadii(style.cornerRadii, inset))
      : null,
    strokeColor: resolve(style.stroke?.color ?? "#000000"),
    strokeWidth,
  };
}

export function ellipseShape(width: number, height: number, style: ShapeStyle, resolve: ColorResolver): ShapePaths {
  const strokeWidth = Math.min(style.stroke?.width ?? 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  return {
    fill: ellipsePath(cx, cy, cx, cy),
    fillColor: resolveFill(style.fill, resolve),
    stroke: style.stroke && strokeWidth > 0
      ? ellipsePath(cx, cy, Math.max(0, cx - strokeWidth / 2), Math.max(0, cy - strokeWidth / 2))
      : null,
    strokeColor: resolve(style.stroke?.color ?? "#000000"),
    strokeWidth,
  };
}

function format(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function pathToString(commands: PathCommand[]): string {
  return commands.map((command) => {
    switch (command.kind) {
      case "move": return `M ${format(command.x)} ${format(command.y)}`;
      case "line": return `L ${format(command.x)} ${format(command.y)}`;
      case "cubic": return `C ${format(command.x1)} ${format(command.y1)} ${format(command.x2)} ${format(command.y2)} ${format(command.x)} ${format(command.y)}`;
      case "arc": {
        const rotation = command.rotation ?? 0;
        const x = command.rx * Math.cos(command.endAngle);
        const y = command.ry * Math.sin(command.endAngle);
        const endX = command.cx + x * Math.cos(rotation) - y * Math.sin(rotation);
        const endY = command.cy + x * Math.sin(rotation) + y * Math.cos(rotation);
        const largeArc = Math.abs(command.endAngle - command.startAngle) > HALF_TURN ? 1 : 0;
        const sweep = command.counterclockwise ? 0 : 1;
        return `A ${format(command.rx)} ${format(command.ry)} ${format(rotation * 180 / Math.PI)} ${largeArc} ${sweep} ${format(endX)} ${format(endY)}`;
      }
      case "close": return "Z";
    }
  }).join(" ");
}

export function tracePath(ctx: CanvasRenderingContext2D, commands: PathCommand[]): void {
  ctx.beginPath();
  for (const command of commands) {
    switch (command.kind) {
      case "move": ctx.moveTo(command.x, command.y); break;
      case "line": ctx.lineTo(command.x, command.y); break;
      case "cubic": ctx.bezierCurveTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y); break;
      case "arc": ctx.ellipse(command.cx, command.cy, command.rx, command.ry, command.rotation ?? 0, command.startAngle, command.endAngle, command.counterclockwise); break;
      case "close": ctx.closePath(); break;
    }
  }
}
