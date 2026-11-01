import type { DrawTool } from "@/pages/editor/types";

export interface DrawingToolsProps {
  drawTool: DrawTool;
  onDrawToolChange(tool: DrawTool): void;
}

export function DrawingTools({ drawTool, onDrawToolChange }: DrawingToolsProps) {
  return <div className="drawing-tools" aria-label="描画ツール">
    <button type="button" aria-pressed={drawTool === "rectangle"} onClick={() => onDrawToolChange(drawTool === "rectangle" ? "select" : "rectangle")}>矩形を描く</button>
    <button type="button" aria-pressed={drawTool === "ellipse"} onClick={() => onDrawToolChange(drawTool === "ellipse" ? "select" : "ellipse")}>楕円を描く</button>
  </div>;
}
