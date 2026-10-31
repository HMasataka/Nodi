export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RectangleStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export const DEFAULT_RECTANGLE_STYLE: RectangleStyle = {
  fill: "#f3d9c8",
  stroke: "#d9bbaa",
  strokeWidth: 1,
  cornerRadius: 2,
};

export interface RectangleNode extends Geometry, RectangleStyle {
  id: string;
  name: string;
  type: "rectangle";
}

export interface FrameNode extends Geometry {
  id: string;
  name: string;
  type: "frame";
  children: DocumentNode[];
}

export interface TextNode extends Geometry {
  id: string;
  name: string;
  type: "text";
  content: string;
}

export type DocumentNode = FrameNode | RectangleNode | TextNode;

export interface Document {
  version: 1;
  children: DocumentNode[];
}
