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

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

export type ShapeStyle = Omit<RectangleStyle, "cornerRadius">;

export interface EllipseNode extends Geometry, ShapeStyle {
  id: string;
  name: string;
  type: "ellipse";
}

export interface ImageNode extends Geometry {
  id: string;
  name: string;
  type: "image";
  source: string;
}

export const IMAGE_SOURCE_PATTERN = /^data:image\/(?:png|jpeg|webp|svg\+xml)(?:;base64)?,.+$/s;
export const MAX_IMAGE_SOURCE_LENGTH = 8_000_000;

export interface FrameStyle {
  background: string;
  clipContent: boolean;
}

export const DEFAULT_FRAME_STYLE: FrameStyle = { background: "#ffffff", clipContent: true };

export const TEXT_FONT_FAMILIES = ["default", "system", "serif", "monospace"] as const;
export type TextFontFamily = (typeof TEXT_FONT_FAMILIES)[number];
export const DEFAULT_TEXT_FONT_FAMILY: TextFontFamily = "default";
export const DEFAULT_TEXT_FONT_WEIGHT = 400;

export interface FrameNode extends Geometry, FrameStyle {
  id: string;
  name: string;
  type: "frame";
  children: DocumentNode[];
}

export interface TextStyle {
  fontSize: number;
  color: string;
  textAlign: "left" | "center" | "right";
  fontFamily?: TextFontFamily;
  fontWeight?: number;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 16,
  color: "#272b29",
  textAlign: "left",
  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
  fontWeight: DEFAULT_TEXT_FONT_WEIGHT,
};

export interface TextNode extends Geometry, TextStyle {
  id: string;
  name: string;
  type: "text";
  content: string;
}

export type DocumentNode = FrameNode | RectangleNode | EllipseNode | TextNode | ImageNode;

export interface Document {
  version: 1;
  children: DocumentNode[];
}
