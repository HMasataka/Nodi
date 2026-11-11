import { type Fill, HEX_COLOR_PATTERN, type LinearFill } from "@/document/types.ts";

export const DEFAULT_LINEAR_FILL: LinearFill = {
  type: "linear", start: { x: 0, y: 0 }, end: { x: 1, y: 0 },
  stops: [{ position: 0, color: "#ffffff" }, { position: 1, color: "#000000" }],
};

const unit = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const point = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === 2 && unit((value as Record<string, unknown>).x) && unit((value as Record<string, unknown>).y);

export function validFill(value: unknown): value is Fill {
  if (value === null) return true;
  if (typeof value === "string") return HEX_COLOR_PATTERN.test(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fill = value as Partial<LinearFill>;
  if (Object.keys(fill).sort().join() !== "end,start,stops,type" || fill.type !== "linear" || !point(fill.start) || !point(fill.end) ||
    (fill.start!.x === fill.end!.x && fill.start!.y === fill.end!.y) || !Array.isArray(fill.stops) || fill.stops.length < 2) return false;
  return fill.stops.every((stop, index) => stop && typeof stop === "object" && !Array.isArray(stop) &&
    Object.keys(stop).sort().join() === "color,position" && unit(stop.position) && typeof stop.color === "string" && HEX_COLOR_PATTERN.test(stop.color) &&
    (index === 0 || fill.stops![index - 1].position <= stop.position));
}
