export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RotatedGeometry extends Geometry { rotation: number }
export interface NodeGeometry extends RotatedGeometry { opacity: number }

export interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface Stroke { color: string; width: number }
export type Border = Partial<Record<"top" | "right" | "bottom" | "left", Stroke>>;
export interface FillStop { position: number; color: string }
export interface LinearFill { type: "linear"; start: { x: number; y: number }; end: { x: number; y: number }; stops: FillStop[] }
export type Fill = string | LinearFill | null;
export interface ShapeStyle { fill: Fill; stroke: Stroke | null }
export interface BoxStyle extends ShapeStyle { cornerRadii: CornerRadii; border: Border }
export type RectangleStyle = BoxStyle;
export type ImageFit = "cover" | "contain" | "fill";
export interface ImageFilters { brightness: number; contrast: number; saturate: number; grayscale: number; sepia: number; hueRotate: number }
export const DEFAULT_IMAGE_FILTERS: ImageFilters = { brightness: 1, contrast: 1, saturate: 1, grayscale: 0, sepia: 0, hueRotate: 0 };
export interface ImageStyle { fit: ImageFit; focalPoint: { x: number; y: number }; cornerRadii: CornerRadii; filters: ImageFilters }
export type ImageStylePatch = Omit<Partial<ImageStyle>, "filters"> & { filters?: Partial<ImageFilters> };
export const DEFAULT_IMAGE_STYLE: ImageStyle = { fit: "cover", focalPoint: { x: 0.5, y: 0.5 }, cornerRadii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 }, filters: DEFAULT_IMAGE_FILTERS };
export const ZERO_CORNER_RADII: CornerRadii = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;

export const DEFAULT_RECTANGLE_STYLE: RectangleStyle = {
  fill: "#f3d9c8",
  stroke: { color: "#d9bbaa", width: 1 },
  cornerRadii: { topLeft: 2, topRight: 2, bottomRight: 2, bottomLeft: 2 },
  border: {},
};

export interface RectangleNode extends NodeGeometry {
  id: string;
  name: string;
  type: "rectangle";
  isMask: boolean;
  style: BoxStyle;
}

export interface EllipseNode extends NodeGeometry {
  id: string;
  name: string;
  type: "ellipse";
  isMask: boolean;
  style: ShapeStyle;
}

export interface ImageNode extends NodeGeometry {
  id: string;
  name: string;
  type: "image";
  source: string;
  style: ImageStyle;
}

export const IMAGE_SOURCE_PATTERN = /^data:image\/(?:png|jpeg|webp|svg\+xml)(?:;base64)?,.+$/s;
export const MAX_IMAGE_SOURCE_LENGTH = 8_000_000;

export interface FrameStyle extends BoxStyle {
  clipContent: boolean;
}

export const DEFAULT_FRAME_STYLE: BoxStyle = { fill: "#ffffff", stroke: null, cornerRadii: ZERO_CORNER_RADII, border: {} };

export const TEXT_FONT_FAMILIES = ["default", "system", "serif", "monospace"] as const;
export type TextFontFamily = (typeof TEXT_FONT_FAMILIES)[number];
export const DEFAULT_TEXT_FONT_FAMILY: TextFontFamily = "default";
export const DEFAULT_TEXT_FONT_WEIGHT = 400;
export const DEFAULT_TEXT_LINE_HEIGHT = 1.4;
export const DEFAULT_TEXT_LETTER_SPACING = 0;

export interface FrameNode extends NodeGeometry {
  id: string;
  name: string;
  type: "frame";
  style: BoxStyle;
  clipContent: boolean;
  children: DocumentNode[];
}

export interface TextStyle {
  fontSize: number;
  color: string;
  textAlign: "left" | "center" | "right";
  fontFamily: TextFontFamily;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 16,
  color: "#272b29",
  textAlign: "left",
  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
  fontWeight: DEFAULT_TEXT_FONT_WEIGHT,
  lineHeight: DEFAULT_TEXT_LINE_HEIGHT,
  letterSpacing: DEFAULT_TEXT_LETTER_SPACING,
};

export interface TextMark {
  start: number;
  end: number;
  color?: string;
  fontWeight?: number;
  underline?: true;
  code?: true;
}

export interface TextMarkPatch {
  color?: string | null;
  fontWeight?: number | null;
  underline?: boolean;
  code?: boolean;
}

export interface TextMarkRangeEdit {
  content: string;
  start: number;
  end: number;
  patch: TextMarkPatch;
}

export interface TextNode extends NodeGeometry {
  id: string;
  name: string;
  type: "text";
  content: string;
  style: TextStyle;
  marks?: TextMark[];
}

export type DocumentNode = FrameNode | RectangleNode | EllipseNode | TextNode | ImageNode;

export interface Document {
  version: 1;
  children: DocumentNode[];
}
