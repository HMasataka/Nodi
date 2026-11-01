import type { Document } from "@/document/types";
import type { Point } from "@/pages/editor/geometry";

export interface SingleDragState {
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

export interface GroupDragState {
  mode: "group";
  ids: string[];
  original: Document;
  pointerId: number;
  clientX: number;
  clientY: number;
  zoom: number;
}

export type DragState = SingleDragState | GroupDragState;

export interface PanState { pointerId: number; clientX: number; clientY: number; scrollLeft: number; scrollTop: number }
export interface SelectionRegion { pointerId: number; start: Point; end: Point; additive: boolean }
export type DrawTool = "select" | "rectangle" | "ellipse";
export interface DrawingState { pointerId: number; tool: Exclude<DrawTool, "select">; start: Point; end: Point; parentId: string | null; parentOrigin: Point }
