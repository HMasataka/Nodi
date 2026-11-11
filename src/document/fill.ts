import { type Fill, HEX_COLOR_PATTERN, type LinearFill, type RadialFill } from "@/document/types.ts";

export const DEFAULT_LINEAR_FILL: LinearFill = {
  type: "linear", start: { x: 0, y: 0 }, end: { x: 1, y: 0 },
  stops: [{ position: 0, color: "#ffffff" }, { position: 1, color: "#000000" }],
};
export const DEFAULT_RADIAL_FILL: RadialFill = {
  type: "radial", center: { x: 0.5, y: 0.5 }, radius: 0.5,
  stops: [{ position: 0, color: "#ffffff" }, { position: 1, color: "#000000" }],
};

const unit = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const point = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === 2 && unit((value as Record<string, unknown>).x) && unit((value as Record<string, unknown>).y);

export function validFill(value: unknown): value is Fill {
  if (value === null) return true;
  if (typeof value === "string") return HEX_COLOR_PATTERN.test(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fill = value as Record<string, unknown>;
  if (fill.type === "linear") {
    if (Object.keys(fill).sort().join() !== "end,start,stops,type" || !point(fill.start) || !point(fill.end) ||
      ((fill.start as LinearFill["start"]).x === (fill.end as LinearFill["end"]).x &&
        (fill.start as LinearFill["start"]).y === (fill.end as LinearFill["end"]).y)) return false;
  } else if (fill.type === "radial") {
    if (Object.keys(fill).sort().join() !== "center,radius,stops,type" || !point(fill.center) || !unit(fill.radius) || fill.radius === 0) return false;
  } else return false;
  if (!Array.isArray(fill.stops) || fill.stops.length < 2) return false;
  const stops = fill.stops as LinearFill["stops"];
  return stops.every((stop, index) => stop && typeof stop === "object" && !Array.isArray(stop) &&
    Object.keys(stop).sort().join() === "color,position" && unit(stop.position) && typeof stop.color === "string" && HEX_COLOR_PATTERN.test(stop.color) &&
    (index === 0 || stops[index - 1].position <= stop.position));
}
