import { layoutTextLines } from "@/rendering/textLayout.ts";
import type { TextLineCounter } from "@/document/commands/index.ts";

let context: CanvasRenderingContext2D | null = null;

export const countRenderedTextLines: TextLineCounter = (node) => {
  if (typeof document === "undefined") return Number.POSITIVE_INFINITY;
  context ??= document.createElement("canvas").getContext("2d");
  return context ? layoutTextLines(context, node).lines.length : Number.POSITIVE_INFINITY;
};
