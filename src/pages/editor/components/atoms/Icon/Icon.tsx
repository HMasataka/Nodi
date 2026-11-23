import type { SVGProps } from "react";

// designs/build.mjs の iconPaths と同じ点列。座標は 0〜1 の割合で、null で線を切り、"close" で閉じる。
type IconPoint = readonly [number, number] | null | "close";

const octagon: IconPoint[] = Array.from({ length: 8 }, (_, index) => {
  const angle = (Math.PI / 4) * index + Math.PI / 8;
  return [0.5 + Math.cos(angle) * 0.36, 0.5 + Math.sin(angle) * 0.36] as const;
});
const smallOctagon: IconPoint[] = octagon.map((point) =>
  Array.isArray(point) ? [0.5 + (point[0] - 0.5) / 3, 0.5 + (point[1] - 0.5) / 3] as const : point);

const iconPoints = {
  select: [[0.28, 0.12], [0.28, 0.82], [0.45, 0.65], [0.57, 0.9], [0.68, 0.85], [0.56, 0.6], [0.8, 0.6], "close"],
  frame: [[0.35, 0.1], [0.35, 0.9], null, [0.65, 0.1], [0.65, 0.9], null, [0.1, 0.35], [0.9, 0.35], null, [0.1, 0.65], [0.9, 0.65]],
  rectangle: [[0.15, 0.2], [0.85, 0.2], [0.85, 0.8], [0.15, 0.8], "close"],
  ellipse: [...octagon, "close"],
  pen: [[0.5, 0.1], [0.82, 0.5], [0.62, 0.9], [0.38, 0.9], [0.18, 0.5], "close", null, [0.5, 0.1], [0.5, 0.55]],
  text: [[0.2, 0.18], [0.8, 0.18], null, [0.5, 0.18], [0.5, 0.85]],
  image: [[0.12, 0.18], [0.88, 0.18], [0.88, 0.82], [0.12, 0.82], "close", null, [0.12, 0.72], [0.4, 0.46], [0.6, 0.66], [0.72, 0.54], [0.88, 0.7]],
  panelLeft: [[0.12, 0.2], [0.88, 0.2], [0.88, 0.8], [0.12, 0.8], "close", null, [0.4, 0.2], [0.4, 0.8]],
  panelRight: [[0.12, 0.2], [0.88, 0.2], [0.88, 0.8], [0.12, 0.8], "close", null, [0.6, 0.2], [0.6, 0.8]],
  preview: [[0.08, 0.5], [0.3, 0.28], [0.5, 0.22], [0.7, 0.28], [0.92, 0.5], [0.7, 0.72], [0.5, 0.78], [0.3, 0.72], "close", null,
    ...smallOctagon, "close"],
  timeline: [[0.12, 0.25], [0.6, 0.25], null, [0.3, 0.5], [0.88, 0.5], null, [0.2, 0.75], [0.72, 0.75]],
  play: [[0.3, 0.2], [0.8, 0.5], [0.3, 0.8], "close"],
  trash: [[0.2, 0.28], [0.8, 0.28], null, [0.4, 0.28], [0.4, 0.15], [0.6, 0.15], [0.6, 0.28], null, [0.28, 0.28], [0.32, 0.85], [0.68, 0.85], [0.72, 0.28]],
  keyframeAdd: [[0.35, 0.15], [0.6, 0.4], [0.35, 0.65], [0.1, 0.4], "close", null, [0.78, 0.55], [0.78, 0.95], null, [0.58, 0.75], [0.98, 0.75]],
  more: [[0.18, 0.5], [0.26, 0.5], null, [0.46, 0.5], [0.54, 0.5], null, [0.74, 0.5], [0.82, 0.5]],
  chevronRight: [[0.4, 0.28], [0.62, 0.5], [0.4, 0.72]],
  chevronLeft: [[0.6, 0.28], [0.38, 0.5], [0.6, 0.72]],
  arrowRight: [[0.15, 0.5], [0.85, 0.5], null, [0.55, 0.22], [0.85, 0.5], [0.55, 0.78]],
  reset: [[0.3, 0.22], [0.12, 0.4], [0.3, 0.58], null, [0.12, 0.4], [0.62, 0.4], [0.85, 0.62], [0.62, 0.84], [0.35, 0.84]],
  corners: [[0.15, 0.4], [0.15, 0.15], [0.4, 0.15], null, [0.6, 0.15], [0.85, 0.15], [0.85, 0.4], null, [0.85, 0.6], [0.85, 0.85], [0.6, 0.85], null, [0.4, 0.85], [0.15, 0.85], [0.15, 0.6]],
  check: [[0.22, 0.52], [0.42, 0.72], [0.78, 0.3]],
  bold: [[0.3, 0.15], [0.3, 0.85], [0.6, 0.85], [0.74, 0.72], [0.74, 0.62], [0.6, 0.5], [0.3, 0.5], null, [0.3, 0.15], [0.56, 0.15], [0.68, 0.25], [0.68, 0.4], [0.56, 0.5]],
  underline: [[0.28, 0.15], [0.28, 0.5], [0.4, 0.66], [0.6, 0.66], [0.72, 0.5], [0.72, 0.15], null, [0.2, 0.86], [0.8, 0.86]],
  code: [[0.35, 0.25], [0.12, 0.5], [0.35, 0.75], null, [0.65, 0.25], [0.88, 0.5], [0.65, 0.75]],
  close: [[0.25, 0.25], [0.75, 0.75], null, [0.75, 0.25], [0.25, 0.75]],
  minus: [[0.2, 0.5], [0.8, 0.5]],
  plus: [[0.5, 0.2], [0.5, 0.8], null, [0.2, 0.5], [0.8, 0.5]],
  chevronDown: [[0.28, 0.4], [0.5, 0.62], [0.72, 0.4]],
  component: [[0.5, 0.1], [0.9, 0.5], [0.5, 0.9], [0.1, 0.5], "close", null, [0.5, 0.3], [0.7, 0.5], [0.5, 0.7], [0.3, 0.5], "close"],
  alert: [...octagon, "close", null, [0.5, 0.3], [0.5, 0.56], null, [0.5, 0.68], [0.5, 0.72]],
  import: [[0.5, 0.12], [0.5, 0.62], null, [0.3, 0.42], [0.5, 0.62], [0.7, 0.42], null, [0.15, 0.62], [0.15, 0.85], [0.85, 0.85], [0.85, 0.62]],
} satisfies Record<string, readonly IconPoint[]>;

export type IconName = keyof typeof iconPoints;
export const ICON_NAMES = Object.keys(iconPoints) as IconName[];

const ICON_SIZE = 16;
const round = (value: number) => Math.round(value * ICON_SIZE * 100) / 100;

export function iconPathData(name: IconName): string {
  let move = true;
  const commands: string[] = [];
  for (const point of iconPoints[name] as readonly IconPoint[]) {
    if (point === null) { move = true; continue; }
    if (point === "close") { commands.push("Z"); continue; }
    commands.push(`${move ? "M" : "L"}${round(point[0])} ${round(point[1])}`);
    move = false;
  }
  return commands.join(" ");
}

type IconProps = { name: IconName } & Omit<SVGProps<SVGSVGElement>, "children">;

export function Icon({ name, className, ...props }: IconProps) {
  return <svg className={className ? `icon ${className}` : "icon"} width={ICON_SIZE} height={ICON_SIZE} viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
    fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
    <path d={iconPathData(name)} />
  </svg>;
}
