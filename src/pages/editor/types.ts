import type { Point } from "@/document/drawing";

export interface DragState {
  mode: "move" | "resize";
  id: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface PanState { pointerId: number; clientX: number; clientY: number; scrollLeft: number; scrollTop: number }
export type DrawTool = "select" | "rectangle" | "ellipse";
export interface DrawingState { pointerId: number; tool: Exclude<DrawTool, "select">; start: Point; end: Point; parentId: string | null; parentOrigin: Point }
