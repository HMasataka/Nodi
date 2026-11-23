import type { Document } from "@/document/types";
import type { Point } from "@/pages/editor/geometry";
import type { RecoveryDraft } from "@/persistence/recovery";
import type { Transform } from "@/document/transform.ts";

export type RecoveryStatus = { kind: "checking" } | { kind: "none" } | { kind: "available"; draft: RecoveryDraft } | { kind: "error"; message: string };

export interface SingleDragState {
  mode: "move" | "resize";
  original: Document;
  id: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  parentTransform: Transform;
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
export type DrawTool = "select" | "frame" | "rectangle" | "ellipse" | "path" | "text";
// ドラッグで外接枠を描いて作るツール。ペン（path）は点を打って描く。
export type ShapeDrawTool = Exclude<DrawTool, "select" | "path">;
export interface DrawingState { pointerId: number; tool: ShapeDrawTool; start: Point; end: Point; parentId: string | null; parentTransform: Transform }
export interface PenState { points: Point[]; cursor: Point; parentId: string | null; parentTransform: Transform }
