export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RotatedGeometry extends Geometry { rotation: number }
export interface Shadow { color: Color; offsetX: number; offsetY: number; blur: number }
export type LayoutMode = "none" | "horizontal" | "vertical";
export const LAYOUT_MODES = ["none", "horizontal", "vertical"] as const;
export type LayoutAlignment = "start" | "center" | "end";
export const LAYOUT_ALIGNMENTS = ["start", "center", "end"] as const;
export type LayoutJustify = "start" | "center" | "end" | "space-between";
export const LAYOUT_JUSTIFIES = ["start", "center", "end", "space-between"] as const;
export type SizeMode = "fixed" | "fill" | "hug";
export const SIZE_MODES = ["fixed", "fill", "hug"] as const;
export interface SizeConstraint { mode: SizeMode; min?: number; max?: number }
export const DEFAULT_SIZE_CONSTRAINT: SizeConstraint = { mode: "fixed" };
export const DEFAULT_LAYOUT_MODE: LayoutMode = "none";
export const DEFAULT_LAYOUT_PADDING = 0;
export const DEFAULT_LAYOUT_GAP = 0;
export const DEFAULT_LAYOUT_ALIGNMENT: LayoutAlignment = "start";
export const DEFAULT_LAYOUT_JUSTIFY: LayoutJustify = "start";

export type AnimatableProperty = "x" | "y" | "scale" | "rotation" | "opacity";
export const ANIMATABLE_PROPERTIES = ["x", "y", "scale", "rotation", "opacity"] as const;
export type AnimationTrigger = "load" | "hover" | "click" | "scroll";
export const ANIMATION_TRIGGERS = ["load", "hover", "click", "scroll"] as const;
export type Easing = "linear" | "ease-in" | "ease-out" | "ease-in-out";
export const EASINGS = ["linear", "ease-in", "ease-out", "ease-in-out"] as const;
export const DEFAULT_EASING: Easing = "linear";
export interface Keyframe { time: number; value: number; easing: Easing }
export interface AnimationTrack { property: AnimatableProperty; keyframes: Keyframe[] }
export interface Animation {
  id: string;
  name: string;
  trigger: AnimationTrigger;
  duration: number;
  delay: number;
  repeat: number;
  tracks: AnimationTrack[];
}
export const DEFAULT_ANIMATION_DELAY = 0;
export const DEFAULT_ANIMATION_REPEAT = 1;

export interface NodeGeometry extends RotatedGeometry {
  opacity: number;
  shadow: Shadow | null;
  blur: number;
  widthConstraint: SizeConstraint;
  heightConstraint: SizeConstraint;
  animations: Animation[];
}

export interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface Stroke { color: Color; width: number }
export type Border = Partial<Record<"top" | "right" | "bottom" | "left", Stroke>>;
export interface FillStop { position: number; color: Color }
export interface LinearFill { type: "linear"; start: { x: number; y: number }; end: { x: number; y: number }; stops: FillStop[] }
export interface RadialFill { type: "radial"; center: { x: number; y: number }; radius: number; stops: FillStop[] }
export type Fill = Color | LinearFill | RadialFill | null;
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

export interface PaletteColor {
  id: string;
  name: string;
  color: string;
}

/** パレット色への参照。名前ではなく安定した ID で参照する。 */
export interface PaletteRef {
  type: "palette";
  id: string;
}

/** 色の値。直接の 6/8桁 HEX 指定か、パレット色への参照。 */
export type Color = string | PaletteRef;

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

export type VectorPathCommand =
  | { kind: "move" | "line"; x: number; y: number }
  | { kind: "cubic"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { kind: "close" };
export type PathFillRule = "nonzero" | "evenodd";
export interface PathNode extends NodeGeometry {
  id: string;
  name: string;
  type: "path";
  commands: VectorPathCommand[];
  fillRule: PathFillRule;
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
  layoutMode: LayoutMode;
  padding: number;
  gap: number;
  alignItems: LayoutAlignment;
  justifyContent: LayoutJustify;
  children: DocumentNode[];
}

export interface TextStyle {
  fontSize: number;
  color: Color;
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
  color?: Color;
  fontWeight?: number;
  underline?: true;
  code?: true;
}

export interface TextMarkPatch {
  color?: Color | null;
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

export interface InstanceOverride {
  content?: string;
  fill?: Fill;
  stroke?: Stroke | null;
  color?: Color;
  source?: string;
  width?: number;
  height?: number;
}

export interface InstanceNode extends NodeGeometry {
  id: string;
  name: string;
  type: "instance";
  componentRef: string;
  overrides: Record<string, InstanceOverride>;
}

export type DocumentNode = FrameNode | RectangleNode | EllipseNode | PathNode | TextNode | ImageNode | InstanceNode;

export interface ComponentDefinition {
  id: string;
  name: string;
  node: DocumentNode;
}

export interface Document {
  version: 1;
  children: DocumentNode[];
  palette: PaletteColor[];
  components: ComponentDefinition[];
}
