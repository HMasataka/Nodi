import type { Border, BoxStyle, CornerRadii, ShapeStyle } from "@/document/types.ts";

export type PathCommand =
  | { kind: "move"; x: number; y: number }
  | { kind: "line"; x: number; y: number }
  | { kind: "arc"; cx: number; cy: number; rx: number; ry: number; startAngle: number; endAngle: number; counterclockwise: boolean }
  | { kind: "close" };

const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

export function roundedRectPath(x: number, y: number, width: number, height: number, radii: CornerRadii): PathCommand[] {
  const { topLeft, topRight, bottomRight, bottomLeft } = radii;
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

function insetRadii(radii: CornerRadii, inset: number): CornerRadii {
  return {
    topLeft: Math.max(0, radii.topLeft - inset),
    topRight: Math.max(0, radii.topRight - inset),
    bottomRight: Math.max(0, radii.bottomRight - inset),
    bottomLeft: Math.max(0, radii.bottomLeft - inset),
  };
}

export interface ShapePaths {
  fill: PathCommand[];
  fillColor: string | null;
  stroke: PathCommand[] | null;
  strokeColor: string;
  strokeWidth: number;
}

export interface BorderPath { side: keyof Border; color: string; commands: PathCommand[] }

export function borderPaths(width: number, height: number, border: Border): BorderPath[] {
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
    return [{ side, color: edge.color, commands: [
      { kind: "move" as const, x: first[0], y: first[1] },
      ...rest.map(([x, y]) => ({ kind: "line" as const, x, y })),
      { kind: "close" as const },
    ] }];
  });
}

export function boxShape(width: number, height: number, style: BoxStyle): ShapePaths {
  const strokeWidth = Math.min(style.stroke?.width ?? 0, width, height);
  const inset = strokeWidth / 2;
  return {
    fill: roundedRectPath(0, 0, width, height, style.cornerRadii),
    fillColor: style.fill,
    stroke: style.stroke && strokeWidth > 0
      ? roundedRectPath(inset, inset, width - strokeWidth, height - strokeWidth, insetRadii(style.cornerRadii, inset))
      : null,
    strokeColor: style.stroke?.color ?? "#000000",
    strokeWidth,
  };
}

export function ellipseShape(width: number, height: number, style: ShapeStyle): ShapePaths {
  const strokeWidth = Math.min(style.stroke?.width ?? 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  return {
    fill: ellipsePath(cx, cy, cx, cy),
    fillColor: style.fill,
    stroke: style.stroke && strokeWidth > 0
      ? ellipsePath(cx, cy, Math.max(0, cx - strokeWidth / 2), Math.max(0, cy - strokeWidth / 2))
      : null,
    strokeColor: style.stroke?.color ?? "#000000",
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
      case "arc": {
        const endX = command.cx + command.rx * Math.cos(command.endAngle);
        const endY = command.cy + command.ry * Math.sin(command.endAngle);
        const largeArc = Math.abs(command.endAngle - command.startAngle) > HALF_TURN ? 1 : 0;
        const sweep = command.counterclockwise ? 0 : 1;
        return `A ${format(command.rx)} ${format(command.ry)} 0 ${largeArc} ${sweep} ${format(endX)} ${format(endY)}`;
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
      case "arc": ctx.ellipse(command.cx, command.cy, command.rx, command.ry, 0, command.startAngle, command.endAngle, command.counterclockwise); break;
      case "close": ctx.closePath(); break;
    }
  }
}
