import { type Border, type BoxStyle, type Color, type Document, type DocumentNode, type Fill, HEX_COLOR_PATTERN, type InstanceOverride, type PaletteColor, type Shadow, type ShapeStyle, type Stroke, type TextMark, type TextStyle } from "@/document/types.ts";

/** 直接の 6/8桁 HEX かパレット参照かを判定する。 */
export function validColor(value: unknown): value is Color {
  if (typeof value === "string") return HEX_COLOR_PATTERN.test(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return ref.type === "palette" && typeof ref.id === "string" && ref.id.trim().length > 0;
}

/** 色参照を解決して 6/8桁 HEX を返す。参照先が見つからない場合は不透明な黒を返す（検証済み文書では発生しない）。 */
export function resolveColor(color: Color, palette: readonly PaletteColor[]): string {
  if (typeof color === "string") return color;
  return palette.find((item) => item.id === color.id)?.color ?? "#000000";
}

function mapFill(fill: Fill, map: (color: Color) => Color): Fill {
  if (fill === null) return null;
  if (typeof fill === "string" || fill.type === "palette") return map(fill);
  let changed = false;
  const stops = fill.stops.map((stop) => {
    const color = map(stop.color);
    if (color !== stop.color) changed = true;
    return color === stop.color ? stop : { ...stop, color };
  });
  return changed ? { ...fill, stops } : fill;
}

function mapStroke(stroke: Stroke | null, map: (color: Color) => Color): Stroke | null {
  if (stroke === null) return null;
  const color = map(stroke.color);
  return color === stroke.color ? stroke : { ...stroke, color };
}

function mapShadow(shadow: Shadow | null, map: (color: Color) => Color): Shadow | null {
  if (shadow === null) return null;
  const color = map(shadow.color);
  return color === shadow.color ? shadow : { ...shadow, color };
}

function mapBorder(border: Border, map: (color: Color) => Color): Border {
  let changed = false;
  const result: Border = {};
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const edge = border[side];
    if (!edge) continue;
    const color = map(edge.color);
    result[side] = color === edge.color ? edge : { ...edge, color };
    if (result[side] !== edge) changed = true;
  }
  return changed ? result : border;
}

function mapShapeStyle(style: ShapeStyle, map: (color: Color) => Color): ShapeStyle {
  const fill = mapFill(style.fill, map);
  const stroke = mapStroke(style.stroke, map);
  return fill === style.fill && stroke === style.stroke ? style : { ...style, fill, stroke };
}

function mapBoxStyle(style: BoxStyle, map: (color: Color) => Color): BoxStyle {
  const fill = mapFill(style.fill, map);
  const stroke = mapStroke(style.stroke, map);
  const border = mapBorder(style.border, map);
  return fill === style.fill && stroke === style.stroke && border === style.border ? style : { ...style, fill, stroke, border };
}

function mapTextStyle(style: TextStyle, map: (color: Color) => Color): TextStyle {
  const color = map(style.color);
  return color === style.color ? style : { ...style, color };
}

function mapMarks(marks: TextMark[] | undefined, map: (color: Color) => Color): TextMark[] | undefined {
  if (marks === undefined) return undefined;
  let changed = false;
  const result = marks.map((mark) => {
    if (mark.color === undefined) return mark;
    const color = map(mark.color);
    if (color !== mark.color) changed = true;
    return color === mark.color ? mark : { ...mark, color };
  });
  return changed ? result : marks;
}

function mapOverride(override: InstanceOverride, map: (color: Color) => Color): InstanceOverride {
  const fill = override.fill === undefined ? undefined : mapFill(override.fill, map);
  const stroke = override.stroke === undefined ? undefined : mapStroke(override.stroke, map);
  const color = override.color === undefined ? undefined : map(override.color);
  if (fill === override.fill && stroke === override.stroke && color === override.color) return override;
  return { ...override, ...(fill === undefined ? {} : { fill }), ...(stroke === undefined ? {} : { stroke }), ...(color === undefined ? {} : { color }) };
}

function mapChildren(nodes: DocumentNode[], map: (color: Color) => Color): DocumentNode[] {
  let changed = false;
  const result = nodes.map((node) => {
    const next = mapNode(node, map);
    if (next !== node) changed = true;
    return next;
  });
  return changed ? result : nodes;
}

function mapNode(node: DocumentNode, map: (color: Color) => Color): DocumentNode {
  const shadow = mapShadow(node.shadow, map);
  switch (node.type) {
    case "rectangle": {
      const style = mapBoxStyle(node.style, map);
      return style === node.style && shadow === node.shadow ? node : { ...node, style, shadow };
    }
    case "ellipse":
    case "path": {
      const style = mapShapeStyle(node.style, map);
      return style === node.style && shadow === node.shadow ? node : { ...node, style, shadow };
    }
    case "frame": {
      const style = mapBoxStyle(node.style, map);
      const children = mapChildren(node.children, map);
      return style === node.style && shadow === node.shadow && children === node.children ? node : { ...node, style, shadow, children };
    }
    case "text": {
      const style = mapTextStyle(node.style, map);
      const marks = mapMarks(node.marks, map);
      return style === node.style && shadow === node.shadow && marks === node.marks ? node : { ...node, style, shadow, ...(marks === undefined ? {} : { marks }) };
    }
    case "image":
      return shadow === node.shadow ? node : { ...node, shadow };
    case "instance": {
      let changed = false;
      const overrides: Record<string, InstanceOverride> = {};
      for (const [key, override] of Object.entries(node.overrides)) {
        const next = mapOverride(override, map);
        if (next !== override) changed = true;
        overrides[key] = next;
      }
      return !changed && shadow === node.shadow ? node : { ...node, shadow, ...(changed ? { overrides } : {}) };
    }
  }
}

/** 文書内のすべての色へ `map` を適用する。変更がなければ入力と同じ参照を返す。 */
export function mapDocumentColors(document: Document, map: (color: Color) => Color): Document {
  const children = mapChildren(document.children, map);
  let componentsChanged = false;
  const components = document.components.map((component) => {
    const node = mapNode(component.node, map);
    if (node !== component.node) componentsChanged = true;
    return node === component.node ? component : { ...component, node };
  });
  if (children === document.children && !componentsChanged) return document;
  return { ...document, children, ...(componentsChanged ? { components } : {}) };
}

/** 文書内のすべての色参照を解決し、直接 HEX に変換した文書を返す（編集画面と PNG で共通）。 */
export function resolveDocumentColors(document: Document): Document {
  const palette = document.palette;
  return mapDocumentColors(document, (color) => resolveColor(color, palette));
}

/** 指定したパレット色への参照をすべて解決済み HEX へ置き換える。参照がなければ入力と同じ参照を返す。 */
export function detachPaletteReferences(document: Document, id: string): Document {
  const entry = document.palette.find((item) => item.id === id);
  if (!entry) return document;
  return mapDocumentColors(document, (color) => (typeof color !== "string" && color.id === id ? entry.color : color));
}
