import type { LayoutMeasure } from "@/document/layout.ts";
import { measureTextSize } from "@/rendering/textLayout.ts";

let context: CanvasRenderingContext2D | null = null;

/** 編集画面・プレビューで共用するテキスト計測。非テキストは格納サイズを返す。 */
export const measureNode: LayoutMeasure = (node, wrapWidth) => {
  if (node.type !== "text" || typeof document === "undefined") return { width: node.width, height: node.height };
  context ??= document.createElement("canvas").getContext("2d");
  return context ? measureTextSize(context, node, wrapWidth) : { width: node.width, height: node.height };
};
