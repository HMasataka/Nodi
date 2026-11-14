import { Result } from "@praha/byethrow";
import { z } from "zod";

import { normalizeRotation } from "@/document/transform.ts";
import { textMarkIssue } from "@/document/textMarks.ts";
import { DEFAULT_IMAGE_FILTERS, DEFAULT_IMAGE_STYLE, DEFAULT_LAYOUT_ALIGNMENT, DEFAULT_LAYOUT_GAP, DEFAULT_LAYOUT_JUSTIFY, DEFAULT_LAYOUT_MODE, DEFAULT_LAYOUT_PADDING, DEFAULT_SIZE_CONSTRAINT, DEFAULT_TEXT_STYLE, type Document, type DocumentNode, HEX_COLOR_PATTERN, IMAGE_SOURCE_PATTERN, LAYOUT_ALIGNMENTS, LAYOUT_JUSTIFIES, LAYOUT_MODES, MAX_IMAGE_SOURCE_LENGTH, SIZE_MODES, type SizeConstraint, TEXT_FONT_FAMILIES, ZERO_CORNER_RADII } from "@/document/types.ts";
import { MAX_PATH_COMMANDS, vectorPathIssue } from "@/document/vectorPath.ts";

const id = z.string().refine((value) => value.trim().length > 0, "ID は空にできません");
const name = z.string().refine((value) => value.trim().length > 0, "名前は空にできません");
const coordinate = z.number().finite();
const dimension = z.number().finite().positive();
const opacity = z.number().finite().min(0).max(1);
const geometry = { x: coordinate, y: coordinate, width: dimension, height: dimension, rotation: coordinate.optional(), opacity: opacity.optional() };

const color = z.string().regex(HEX_COLOR_PATTERN);
const shadow = z.strictObject({ color, offsetX: coordinate, offsetY: coordinate, blur: z.number().finite().nonnegative() });
const blur = z.number().finite().nonnegative();
const sizeMode = z.enum(SIZE_MODES);
const sizeConstraint = z.strictObject({ mode: sizeMode, min: dimension.optional(), max: dimension.optional() })
  .refine((value) => value.min === undefined || value.max === undefined || value.min <= value.max, "最小値は最大値以下にしてください");
const layoutMode = z.enum(LAYOUT_MODES);
const layoutAlignment = z.enum(LAYOUT_ALIGNMENTS);
const layoutJustify = z.enum(LAYOUT_JUSTIFIES);
const layoutPadding = z.number().finite().nonnegative();
const layoutGap = z.number().finite().nonnegative();
const wireGeometry = { ...geometry, shadow: shadow.nullable().optional(), blur: blur.optional(), widthConstraint: sizeConstraint.optional(), heightConstraint: sizeConstraint.optional() };
const unit = z.number().finite().min(0).max(1);
const point = z.strictObject({ x: unit, y: unit });
const stop = z.strictObject({ position: unit, color });
const stops = z.array(stop).min(2).refine((items) => items.every((item, index) => index === 0 || items[index - 1].position <= item.position), "色ストップを位置順に指定してください");
const linearFill = z.strictObject({ type: z.literal("linear"), start: point, end: point, stops })
  .refine((value) => value.start.x !== value.end.x || value.start.y !== value.end.y, "方向の始点と終点は異なる位置にしてください");
const radialFill = z.strictObject({ type: z.literal("radial"), center: point, radius: unit.positive(), stops });
const fill = z.union([color, linearFill, radialFill]).nullable();
const textMark = z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive(), color: color.optional(),
  fontWeight: z.number().int().min(100).max(900).refine((value) => value % 100 === 0).optional(),
  underline: z.literal(true).optional(), code: z.literal(true).optional() });
const radius = z.number().finite().nonnegative();
const cornerRadii = z.strictObject({ topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius });
const stroke = z.strictObject({ color, width: radius }).nullable();
const shapeStyle = z.strictObject({ fill, stroke: stroke.optional() });
const normalizedShapeStyle = z.strictObject({ fill, stroke });
const vectorCommand = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("move"), x: coordinate, y: coordinate }),
  z.strictObject({ kind: z.literal("line"), x: coordinate, y: coordinate }),
  z.strictObject({ kind: z.literal("cubic"), x1: coordinate, y1: coordinate, x2: coordinate, y2: coordinate, x: coordinate, y: coordinate }),
  z.strictObject({ kind: z.literal("close") }),
]);
const vectorCommands = z.array(vectorCommand).min(2).max(MAX_PATH_COMMANDS)
  .refine((value) => vectorPathIssue(value, "nonzero") === null, "パス命令の順序が不正です");
const fillRule = z.enum(["nonzero", "evenodd"]);
const borderEdge = z.strictObject({ color, width: radius });
const border = z.strictObject({ top: borderEdge.optional(), right: borderEdge.optional(), bottom: borderEdge.optional(), left: borderEdge.optional() });
const compatibleBorder = (style: { border?: z.infer<typeof border>; cornerRadii?: z.infer<typeof cornerRadii> }) =>
  !style.border || Object.keys(style.border).length === 0 || !style.cornerRadii || Object.values(style.cornerRadii).every((value) => value === 0);
const boxStyle = z.strictObject({ ...shapeStyle.shape, cornerRadii: cornerRadii.optional(), border: border.optional() }).refine(
  compatibleBorder,
  { message: "辺線と角丸は併用できません", path: ["border"] },
);
const normalizedBoxStyle = z.strictObject({ ...normalizedShapeStyle.shape, cornerRadii, border }).refine(
  compatibleBorder, { message: "辺線と角丸は併用できません", path: ["border"] },
);
const fontWeight = z.number().int().min(100).max(900).refine((value) => value % 100 === 0);
const fontFamily = z.enum(TEXT_FONT_FAMILIES);
const lineHeight = z.number().finite().positive();
const textStyleBase = { fontSize: z.number().finite().positive(), color, textAlign: z.enum(["left", "center", "right"]) };
const textStyle = z.strictObject({ ...textStyleBase, fontFamily: fontFamily.optional(), fontWeight: fontWeight.optional(), lineHeight: lineHeight.optional(), letterSpacing: coordinate.optional() });
const normalizedTextStyle = z.strictObject({ ...textStyleBase, fontFamily, fontWeight, lineHeight, letterSpacing: coordinate });
const intensity = z.number().finite().min(0).max(1);
const filterFields = { brightness: radius, contrast: radius, saturate: radius, grayscale: intensity, sepia: intensity, hueRotate: coordinate };
const imageFilters = z.strictObject({ brightness: radius.optional(), contrast: radius.optional(), saturate: radius.optional(), grayscale: intensity.optional(), sepia: intensity.optional(), hueRotate: coordinate.optional() });
const normalizedImageFilters = z.strictObject(filterFields);
const fit = z.enum(["cover", "contain", "fill"]);
const focalPoint = z.strictObject({ x: intensity, y: intensity });
const imageStyle = z.strictObject({ fit: fit.optional(), focalPoint: focalPoint.optional(), cornerRadii: cornerRadii.optional(), filters: imageFilters.optional() });
const normalizedImageStyle = z.strictObject({ fit, focalPoint, cornerRadii, filters: normalizedImageFilters });

type OptionalRotation<T> = Omit<T, "rotation"> & { rotation?: number };
type OptionalOpacity<T> = Omit<T, "opacity"> & { opacity?: number };
type OptionalShadow<T> = Omit<T, "shadow"> & { shadow?: z.infer<typeof shadow> | null };
type OptionalBlur<T> = Omit<T, "blur"> & { blur?: number };
type OptionalMask<T> = Omit<T, "isMask"> & { isMask?: true };
type OptionalFillRule<T> = Omit<T, "fillRule"> & { fillRule?: z.infer<typeof fillRule> };
type OptionalSize<T> = Omit<T, "widthConstraint" | "heightConstraint"> & {
  widthConstraint?: z.infer<typeof sizeConstraint>;
  heightConstraint?: z.infer<typeof sizeConstraint>;
};
type OptionalLayout<T> = Omit<T, "layoutMode" | "padding" | "gap" | "alignItems" | "justifyContent"> & {
  layoutMode?: z.infer<typeof layoutMode>;
  padding?: number;
  gap?: number;
  alignItems?: z.infer<typeof layoutAlignment>;
  justifyContent?: z.infer<typeof layoutJustify>;
};
export type WireNode =
  | OptionalSize<OptionalBlur<OptionalShadow<OptionalOpacity<OptionalRotation<OptionalMask<Omit<Extract<DocumentNode, { type: "rectangle" }>, "style"> & { style: z.infer<typeof boxStyle> }>>>>>>
  | OptionalSize<OptionalBlur<OptionalShadow<OptionalOpacity<OptionalRotation<OptionalMask<Omit<Extract<DocumentNode, { type: "ellipse" }>, "style"> & { style: z.infer<typeof shapeStyle> }>>>>>>
  | OptionalSize<OptionalBlur<OptionalShadow<OptionalOpacity<OptionalRotation<OptionalFillRule<Omit<Extract<DocumentNode, { type: "path" }>, "style"> & { style: z.infer<typeof shapeStyle> }>>>>>>
  | OptionalSize<OptionalBlur<OptionalShadow<OptionalOpacity<OptionalRotation<Omit<Extract<DocumentNode, { type: "image" }>, "style"> & { style: z.infer<typeof imageStyle> }>>>>>
  | OptionalSize<OptionalBlur<OptionalShadow<OptionalOpacity<OptionalRotation<Omit<Extract<DocumentNode, { type: "text" }>, "style"> & { style: z.infer<typeof textStyle> }>>>>>
  | OptionalSize<OptionalLayout<OptionalBlur<OptionalShadow<OptionalOpacity<OptionalRotation<Omit<Extract<DocumentNode, { type: "frame" }>, "style" | "children" | "clipContent"> & { style: z.infer<typeof boxStyle>; clipContent?: boolean; children: WireNode[] }>>>>>>;
export interface WireDocument { version: 1; children: WireNode[] }

const nodeSchema: z.ZodType<WireNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ id, name, type: z.literal("rectangle"), ...wireGeometry, isMask: z.literal(true).optional(), style: boxStyle }),
    z.strictObject({ id, name, type: z.literal("ellipse"), ...wireGeometry, isMask: z.literal(true).optional(), style: shapeStyle }),
    z.strictObject({ id, name, type: z.literal("path"), ...wireGeometry, commands: vectorCommands, fillRule: fillRule.optional(), style: shapeStyle }),
    z.strictObject({ id, name, type: z.literal("image"), ...wireGeometry, style: imageStyle, source: z.string().max(MAX_IMAGE_SOURCE_LENGTH).regex(IMAGE_SOURCE_PATTERN) }),
    z.strictObject({ id, name, type: z.literal("frame"), ...wireGeometry, style: boxStyle, clipContent: z.boolean().optional(),
      layoutMode: layoutMode.optional(), padding: layoutPadding.optional(), gap: layoutGap.optional(), alignItems: layoutAlignment.optional(), justifyContent: layoutJustify.optional(),
      children: z.array(nodeSchema) }),
    z.strictObject({ id, name, type: z.literal("text"), ...wireGeometry, content: z.string(), style: textStyle, marks: z.array(textMark).optional() }),
  ]),
);

function checkUniqueIds(
  document: { children: (WireNode | DocumentNode)[] },
  context: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
) {
  const seen = new Set<string>();
  function visit(nodes: (WireNode | DocumentNode)[], path: (string | number)[]) {
    nodes.forEach((node, index) => {
      const nodePath = [...path, index];
      if (seen.has(node.id)) context.addIssue({ code: "custom", path: [...nodePath, "id"], message: `ID が重複しています: ${node.id}` });
      seen.add(node.id);
      if (node.type === "text" && node.marks) {
        const issue = textMarkIssue(node.content, node.marks);
        if (issue) context.addIssue({ code: "custom", path: [...nodePath, "marks"], message: issue });
      }
      if (node.type === "frame") visit(node.children, [...nodePath, "children"]);
    });
  }
  visit(document.children, ["children"]);
}

export const documentSchema = z.strictObject({ version: z.literal(1), children: z.array(nodeSchema) }).superRefine(checkUniqueIds);

const internalGeometry = { x: coordinate, y: coordinate, width: dimension, height: dimension, rotation: coordinate, opacity, shadow: shadow.nullable(), blur, widthConstraint: sizeConstraint, heightConstraint: sizeConstraint };
const internalNodeSchema: z.ZodType<DocumentNode> = z.lazy(() => z.discriminatedUnion("type", [
  z.strictObject({ id, name, type: z.literal("rectangle"), ...internalGeometry, isMask: z.boolean(), style: normalizedBoxStyle }),
  z.strictObject({ id, name, type: z.literal("ellipse"), ...internalGeometry, isMask: z.boolean(), style: normalizedShapeStyle }),
  z.strictObject({ id, name, type: z.literal("path"), ...internalGeometry, commands: vectorCommands, fillRule, style: normalizedShapeStyle }),
  z.strictObject({ id, name, type: z.literal("image"), ...internalGeometry, style: normalizedImageStyle, source: z.string().max(MAX_IMAGE_SOURCE_LENGTH).regex(IMAGE_SOURCE_PATTERN) }),
  z.strictObject({ id, name, type: z.literal("frame"), ...internalGeometry, style: normalizedBoxStyle, clipContent: z.boolean(), layoutMode, padding: layoutPadding, gap: layoutGap, alignItems: layoutAlignment, justifyContent: layoutJustify, children: z.array(internalNodeSchema) }),
  z.strictObject({ id, name, type: z.literal("text"), ...internalGeometry, content: z.string(), style: normalizedTextStyle, marks: z.array(textMark).optional() }),
]));

export const internalDocumentSchema = z.strictObject({ version: z.literal(1), children: z.array(internalNodeSchema) }).superRefine(checkUniqueIds);

function normalizeNode(node: WireNode): DocumentNode {
  const rotation = normalizeRotation(node.rotation ?? 0);
  const opacity = node.opacity ?? 1;
  const shadow = node.shadow ?? null;
  const blur = node.blur ?? 0;
  const widthConstraint = node.widthConstraint ? { ...node.widthConstraint } : { ...DEFAULT_SIZE_CONSTRAINT };
  const heightConstraint = node.heightConstraint ? { ...node.heightConstraint } : { ...DEFAULT_SIZE_CONSTRAINT };
  switch (node.type) {
    case "image": return { ...node, rotation, opacity, shadow, blur, widthConstraint, heightConstraint, style: { fit: node.style.fit ?? DEFAULT_IMAGE_STYLE.fit, focalPoint: node.style.focalPoint ?? { ...DEFAULT_IMAGE_STYLE.focalPoint }, cornerRadii: node.style.cornerRadii ?? { ...ZERO_CORNER_RADII }, filters: { ...DEFAULT_IMAGE_FILTERS, ...node.style.filters } } };
    case "text": return { ...node, rotation, opacity, shadow, blur, widthConstraint, heightConstraint, style: { ...node.style,
      fontFamily: node.style.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily,
      fontWeight: node.style.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight,
      lineHeight: node.style.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
      letterSpacing: node.style.letterSpacing ?? DEFAULT_TEXT_STYLE.letterSpacing,
    } };
    case "ellipse": return { ...node, rotation, opacity, shadow, blur, widthConstraint, heightConstraint, isMask: node.isMask ?? false, style: { ...node.style, stroke: node.style.stroke ?? null } };
    case "path": return { ...node, rotation, opacity, shadow, blur, widthConstraint, heightConstraint, fillRule: node.fillRule ?? "nonzero", style: { ...node.style, stroke: node.style.stroke ?? null } };
    case "rectangle": return { ...node, rotation, opacity, shadow, blur, widthConstraint, heightConstraint, isMask: node.isMask ?? false, style: { ...node.style, stroke: node.style.stroke ?? null, cornerRadii: node.style.cornerRadii ?? { ...ZERO_CORNER_RADII }, border: node.style.border ?? {} } };
    case "frame": return { ...node, rotation, opacity, shadow, blur, widthConstraint, heightConstraint, style: { ...node.style, stroke: node.style.stroke ?? null, cornerRadii: node.style.cornerRadii ?? { ...ZERO_CORNER_RADII }, border: node.style.border ?? {} }, clipContent: node.clipContent ?? true, layoutMode: node.layoutMode ?? DEFAULT_LAYOUT_MODE, padding: node.padding ?? DEFAULT_LAYOUT_PADDING, gap: node.gap ?? DEFAULT_LAYOUT_GAP, alignItems: node.alignItems ?? DEFAULT_LAYOUT_ALIGNMENT, justifyContent: node.justifyContent ?? DEFAULT_LAYOUT_JUSTIFY, children: node.children.map(normalizeNode) };
  }
}

function compactSize(key: "widthConstraint" | "heightConstraint", constraint: SizeConstraint) {
  if (constraint.mode === "fixed" && constraint.min === undefined && constraint.max === undefined) return {};
  return { [key]: { mode: constraint.mode, ...(constraint.min === undefined ? {} : { min: constraint.min }), ...(constraint.max === undefined ? {} : { max: constraint.max }) } };
}

function compactNode(node: DocumentNode): WireNode {
  const rotation = normalizeRotation(node.rotation);
  const rotationField = rotation === 0 ? {} : { rotation };
  const opacityField = node.opacity === 1 ? {} : { opacity: node.opacity };
  const shadowField = node.shadow === null ? {} : { shadow: node.shadow };
  const blurField = node.blur === 0 ? {} : { blur: node.blur };
  const sizeFields = { ...compactSize("widthConstraint", node.widthConstraint), ...compactSize("heightConstraint", node.heightConstraint) };
  if (node.type === "image") {
    const { rotation: _, opacity: _opacity, shadow: _shadow, blur: _blur, widthConstraint: _width, heightConstraint: _height, ...rest } = node;
    return { ...rest, ...rotationField, ...opacityField, ...shadowField, ...blurField, ...sizeFields, style: {
      ...(node.style.fit === DEFAULT_IMAGE_STYLE.fit ? {} : { fit: node.style.fit }),
      ...(node.style.focalPoint.x === DEFAULT_IMAGE_STYLE.focalPoint.x && node.style.focalPoint.y === DEFAULT_IMAGE_STYLE.focalPoint.y ? {} : { focalPoint: node.style.focalPoint }),
      ...(Object.values(node.style.cornerRadii).some((value) => value !== 0) ? { cornerRadii: node.style.cornerRadii } : {}),
      ...(Object.entries(node.style.filters).some(([key, value]) => value !== DEFAULT_IMAGE_FILTERS[key as keyof typeof DEFAULT_IMAGE_FILTERS]) ? { filters: Object.fromEntries(Object.entries(node.style.filters).filter(([key, value]) => value !== DEFAULT_IMAGE_FILTERS[key as keyof typeof DEFAULT_IMAGE_FILTERS])) } : {}),
    } };
  }
  if (node.type === "text") {
    const { rotation: _, opacity: _opacity, shadow: _shadow, blur: _blur, widthConstraint: _width, heightConstraint: _height, ...rest } = node;
    const { fontFamily, fontWeight, lineHeight, letterSpacing, ...required } = node.style;
    return { ...rest, ...rotationField, ...opacityField, ...shadowField, ...blurField, ...sizeFields, style: { ...required,
      ...(fontFamily === DEFAULT_TEXT_STYLE.fontFamily ? {} : { fontFamily }),
      ...(fontWeight === DEFAULT_TEXT_STYLE.fontWeight ? {} : { fontWeight }),
      ...(lineHeight === DEFAULT_TEXT_STYLE.lineHeight ? {} : { lineHeight }),
      ...(letterSpacing === DEFAULT_TEXT_STYLE.letterSpacing ? {} : { letterSpacing }),
    } };
  }
  if (node.type === "path") {
    const { rotation: _, opacity: _opacity, shadow: _shadow, blur: _blur, fillRule: _fillRule, widthConstraint: _width, heightConstraint: _height, ...rest } = node;
    return { ...rest, ...rotationField, ...opacityField, ...shadowField, ...blurField, ...sizeFields,
      ...(node.fillRule === "nonzero" ? {} : { fillRule: node.fillRule }),
      style: { fill: node.style.fill, ...(node.style.stroke ? { stroke: node.style.stroke } : {}) } };
  }
  const style = { fill: node.style.fill, ...(node.style.stroke === null ? {} : { stroke: node.style.stroke }),
    ...(node.type !== "ellipse" && Object.values(node.style.cornerRadii).some((value) => value !== 0) ? { cornerRadii: node.style.cornerRadii } : {}),
    ...(node.type !== "ellipse" && Object.keys(node.style.border).length ? { border: node.style.border } : {}) };
  if (node.type === "frame") {
    const { rotation: _rotation, opacity: _opacity, shadow: _shadow, blur: _blur, clipContent: _clipContent, widthConstraint: _width, heightConstraint: _height, layoutMode, padding, gap, alignItems, justifyContent, ...rest } = node;
    const layoutFields = {
      ...(layoutMode === DEFAULT_LAYOUT_MODE ? {} : { layoutMode }),
      ...(padding === DEFAULT_LAYOUT_PADDING ? {} : { padding }),
      ...(gap === DEFAULT_LAYOUT_GAP ? {} : { gap }),
      ...(alignItems === DEFAULT_LAYOUT_ALIGNMENT ? {} : { alignItems }),
      ...(justifyContent === DEFAULT_LAYOUT_JUSTIFY ? {} : { justifyContent }),
    };
    return { ...rest, ...rotationField, ...opacityField, ...shadowField, ...blurField, ...sizeFields, ...layoutFields, style, ...(node.clipContent ? {} : { clipContent: false }), children: node.children.map(compactNode) };
  }
  if (node.type === "ellipse" || node.type === "rectangle") {
    const { rotation: _, opacity: _opacity, shadow: _shadow, blur: _blur, isMask: _mask, widthConstraint: _width, heightConstraint: _height, ...rest } = node;
    return { ...rest, ...rotationField, ...opacityField, ...shadowField, ...blurField, ...sizeFields, ...(node.isMask ? { isMask: true as const } : {}), style };
  }
  return node;
}

const parseJson = Result.fn({
  try: (json: string): unknown => JSON.parse(json),
  catch: (error) => new Error(`JSON を読み取れません: ${error instanceof Error ? error.message : String(error)}`),
});

export function parseDocument(json: string) {
  const parsed = parseJson(json);
  if (Result.isFailure(parsed)) return parsed;
  const validated = Result.parse(documentSchema, parsed.value);
  return Result.isFailure(validated) ? validated : Result.succeed({ version: 1 as const, children: validated.value.children.map(normalizeNode) });
}

export function serializeDocument(document: Document) {
  const parsed = Result.parse(internalDocumentSchema, document);
  if (Result.isFailure(parsed)) return parsed;
  const wire = Result.parse(documentSchema, { version: 1, children: parsed.value.children.map(compactNode) });
  if (Result.isFailure(wire)) return wire;
  return Result.succeed(JSON.stringify(wire.value, null, 2));
}
