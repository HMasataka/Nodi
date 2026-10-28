export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RectangleNode extends Geometry {
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

export type DocumentNode = FrameNode | RectangleNode;

export interface Document {
  version: 1;
  children: DocumentNode[];
}
