import { Result } from "@praha/byethrow";
import { z } from "zod";

import { normalizeRotation } from "@/document/transform.ts";
import { textMarkIssue } from "@/document/textMarks.ts";
import { ANIMATABLE_PROPERTIES, type Animation, ANIMATION_TRIGGERS, DEFAULT_ANIMATION_DELAY, DEFAULT_ANIMATION_REPEAT, DEFAULT_EASING, DEFAULT_IMAGE_FILTERS, DEFAULT_IMAGE_STYLE, DEFAULT_LAYOUT_ALIGNMENT, DEFAULT_LAYOUT_GAP, DEFAULT_LAYOUT_JUSTIFY, DEFAULT_LAYOUT_MODE, DEFAULT_LAYOUT_PADDING, DEFAULT_SIZE_CONSTRAINT, DEFAULT_TEXT_STYLE, type Document, type DocumentNode, EASINGS, HEX_COLOR_PATTERN, IMAGE_SOURCE_PATTERN, LAYOUT_ALIGNMENTS, LAYOUT_JUSTIFIES, LAYOUT_MODES, MAX_IMAGE_SOURCE_LENGTH, type PaletteColor, SIZE_MODES, type SizeConstraint, TEXT_FONT_FAMILIES, ZERO_CORNER_RADII } from "@/document/types.ts";
import { MAX_PATH_COMMANDS, vectorPathIssue } from "@/document/vectorPath.ts";

const id = z.string().refine((value) => value.trim().length > 0, "ID は空にできません");
const name = z.string().refine((value) => value.trim().length > 0, "名前は空にできません");
const coordinate = z.number().finite();
const dimension = z.number().finite().positive();
const opacity = z.number().finite().min(0).max(1);
const geometry = { x: coordinate, y: coordinate, width: dimension, height: dimension, rotation: coordinate.optional(), opacity: opacity.optional() };

const hexColor = z.string().regex(HEX_COLOR_PATTERN);
const paletteRef = z.strictObject({ type: z.literal("palette"), id });
const color = z.union([hexColor, paletteRef]);
const paletteColor = z.strictObject({ id, name, color: hexColor });
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
const animatableProperty = z.enum(ANIMATABLE_PROPERTIES);
const animationTrigger = z.enum(ANIMATION_TRIGGERS);
const easing = z.enum(EASINGS);
const animationTime = z.number().finite().nonnegative();
const keyframe = z.strictObject({ time: animationTime, value: coordinate, easing: easing.optional() });
const animationTrack = z.strictObject({ property: animatableProperty, keyframes: z.array(keyframe).min(1) })
  .refine((track) => track.keyframes.every((item, index) => index === 0 || track.keyframes[index - 1].time <= item.time), "キーフレームを時刻順に指定してください");
const animation = z.strictObject({ id, name, trigger: animationTrigger, duration: dimension, delay: animationTime.optional(), repeat: z.number().int().positive().optional(), tracks: z.array(animationTrack).min(1) })
  .refine((value) => new Set(value.tracks.map((track) => track.property)).size === value.tracks.length, "同じ属性のトラックを複数指定できません");
const normalizedKeyframe = z.strictObject({ time: animationTime, value: coordinate, easing });
const normalizedAnimationTrack = z.strictObject({ property: animatableProperty, keyframes: z.array(normalizedKeyframe).min(1) })
  .refine((track) => track.keyframes.every((item, index) => index === 0 || track.keyframes[index - 1].time <= item.time), "キーフレームを時刻順に指定してください");
const normalizedAnimation = z.strictObject({ id, name, trigger: animationTrigger, duration: dimension, delay: animationTime, repeat: z.number().int().positive(), tracks: z.array(normalizedAnimationTrack).min(1) })
  .refine((value) => new Set(value.tracks.map((track) => track.property)).size === value.tracks.length, "同じ属性のトラックを複数指定できません");
const wireGeometry = { ...geometry, shadow: shadow.nullable().optional(), blur: blur.optional(), widthConstraint: sizeConstraint.optional(), heightConstraint: sizeConstraint.optional(), animations: z.array(animation).optional() };
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

const instanceOverride = z.strictObject({
  content: z.string().optional(),
  fill: fill.optional(),
  stroke: stroke.optional(),
  color: color.optional(),
  source: z.string().max(MAX_IMAGE_SOURCE_LENGTH).regex(IMAGE_SOURCE_PATTERN).optional(),
  width: dimension.optional(),
  height: dimension.optional(),
});

// 共通項目の省略可否はスキーマを型の情報源にする。
type WireCommonFields = { id: string; name: string } & z.infer<z.ZodObject<typeof wireGeometry>>;
type WireFrameLayout = {
  layoutMode?: z.infer<typeof layoutMode>;
  padding?: number;
  gap?: number;
  alignItems?: z.infer<typeof layoutAlignment>;
  justifyContent?: z.infer<typeof layoutJustify>;
};
export type WireNode = WireCommonFields & (
  | { type: "rectangle"; style: z.infer<typeof boxStyle>; isMask?: true }
  | { type: "ellipse"; style: z.infer<typeof shapeStyle>; isMask?: true }
  | { type: "path"; style: z.infer<typeof shapeStyle>; commands: z.infer<typeof vectorCommands>; fillRule?: z.infer<typeof fillRule> }
  | { type: "image"; style: z.infer<typeof imageStyle>; source: string }
  | { type: "text"; style: z.infer<typeof textStyle>; content: string; marks?: z.infer<typeof textMark>[] }
  | { type: "instance"; componentRef: string; overrides?: Record<string, z.infer<typeof instanceOverride>> }
  | ({ type: "frame"; style: z.infer<typeof boxStyle>; clipContent?: boolean; children: WireNode[] } & WireFrameLayout)
);
export interface WireComponentDefinition { id: string; name: string; node: WireNode }
export interface WireDocument { version: 1; children: WireNode[]; palette?: PaletteColor[]; components?: WireComponentDefinition[] }

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
    z.strictObject({ id, name, type: z.literal("instance"), ...wireGeometry, componentRef: id, overrides: z.record(z.string(), instanceOverride).optional() }),
  ]),
);

const componentDefinition = z.strictObject({ id, name, node: nodeSchema });

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

function checkUniquePaletteIds(
  document: { palette?: PaletteColor[] },
  context: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
) {
  const seen = new Set<string>();
  (document.palette ?? []).forEach((color, index) => {
    if (seen.has(color.id)) context.addIssue({ code: "custom", path: ["palette", index, "id"], message: `ID が重複しています: ${color.id}` });
    seen.add(color.id);
  });
}

function checkUniqueComponentIds(
  document: { components?: { id: string; node: WireNode | DocumentNode }[] },
  context: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
) {
  const seen = new Set<string>();
  function visitNodes(nodes: (WireNode | DocumentNode)[], path: (string | number)[]) {
    nodes.forEach((node, index) => {
      const nodePath = [...path, index];
      if (seen.has(node.id)) context.addIssue({ code: "custom", path: [...nodePath, "id"], message: `ID が重複しています: ${node.id}` });
      seen.add(node.id);
      if (node.type === "text" && node.marks) {
        const issue = textMarkIssue(node.content, node.marks);
        if (issue) context.addIssue({ code: "custom", path: [...nodePath, "marks"], message: issue });
      }
      if (node.type === "frame") visitNodes(node.children, [...nodePath, "children"]);
    });
  }
  (document.components ?? []).forEach((component, index) => {
    if (seen.has(component.id)) context.addIssue({ code: "custom", path: ["components", index, "id"], message: `ID が重複しています: ${component.id}` });
    seen.add(component.id);
    visitNodes([component.node], ["components", index, "node"]);
  });
}

function collectInstanceRefs(node: WireNode | DocumentNode, refs: Set<string>) {
  if (node.type === "instance") refs.add(node.componentRef);
  if (node.type === "frame") node.children.forEach((child) => collectInstanceRefs(child, refs));
}

function checkComponentReferences(
  document: { children: (WireNode | DocumentNode)[]; components?: { id: string; node: WireNode | DocumentNode }[] },
  context: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
) {
  const components = document.components ?? [];
  const componentIds = new Set(components.map((component) => component.id));
  function checkDangling(nodes: (WireNode | DocumentNode)[], path: (string | number)[]) {
    nodes.forEach((node, index) => {
      const nodePath = [...path, index];
      if (node.type === "instance" && !componentIds.has(node.componentRef)) {
        context.addIssue({ code: "custom", path: [...nodePath, "componentRef"], message: `コンポーネント定義が見つかりません: ${node.componentRef}` });
      }
      if (node.type === "frame") checkDangling(node.children, [...nodePath, "children"]);
    });
  }
  checkDangling(document.children, ["children"]);
  components.forEach((component, index) => checkDangling([component.node], ["components", index, "node"]));

  const graph = new Map<string, Set<string>>();
  for (const component of components) graph.set(component.id, new Set());
  for (const component of components) {
    const refs = new Set<string>();
    collectInstanceRefs(component.node, refs);
    for (const ref of refs) if (graph.has(ref)) graph.get(component.id)!.add(ref);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function hasCycle(componentId: string): boolean {
    if (visiting.has(componentId)) return true;
    if (visited.has(componentId)) return false;
    visiting.add(componentId);
    for (const next of graph.get(componentId)!) if (hasCycle(next)) return true;
    visiting.delete(componentId);
    visited.add(componentId);
    return false;
  }
  for (const componentId of graph.keys()) {
    if (hasCycle(componentId)) {
      context.addIssue({ code: "custom", path: ["components"], message: "コンポーネントの循環参照があります" });
      return;
    }
  }
}

function checkPaletteReferences(
  document: { children: (WireNode | DocumentNode)[]; palette?: PaletteColor[]; components?: { node: WireNode | DocumentNode }[] },
  context: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
) {
  const ids = new Set((document.palette ?? []).map((item) => item.id));
  const visitColor = (value: unknown, path: (string | number)[]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const ref = value as { type?: unknown; id?: unknown };
    if (ref.type !== "palette" || typeof ref.id !== "string" || ids.has(ref.id)) return;
    context.addIssue({ code: "custom", path: ["palette", ...path], message: `参照先のパレット色が見つかりません: ${ref.id}` });
  };
  const visitFill = (value: unknown, path: (string | number)[]) => {
    if (value === null || typeof value === "string") return;
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const fill = value as { type?: unknown; stops?: unknown };
    if (fill.type === "palette") { visitColor(value, path); return; }
    if (Array.isArray(fill.stops)) {
      fill.stops.forEach((stop, index) => {
        if (stop && typeof stop === "object") visitColor((stop as { color?: unknown }).color, [...path, "stops", index, "color"]);
      });
    }
  };
  const visitStyle = (value: unknown, path: (string | number)[]) => {
    if (!value || typeof value !== "object") return;
    const style = value as Record<string, unknown>;
    if ("fill" in style) visitFill(style.fill, [...path, "fill"]);
    if ("stroke" in style && style.stroke && typeof style.stroke === "object") visitColor((style.stroke as { color?: unknown }).color, [...path, "stroke", "color"]);
    if ("border" in style && style.border && typeof style.border === "object") {
      for (const side of ["top", "right", "bottom", "left"] as const) {
        const edge = (style.border as Record<string, unknown>)[side];
        if (edge && typeof edge === "object") visitColor((edge as { color?: unknown }).color, [...path, "border", side, "color"]);
      }
    }
    if ("color" in style) visitColor(style.color, [...path, "color"]);
  };
  const visitNode = (value: unknown, path: (string | number)[]) => {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (node.shadow && typeof node.shadow === "object") visitColor((node.shadow as { color?: unknown }).color, [...path, "shadow", "color"]);
    if (node.style) visitStyle(node.style, [...path, "style"]);
    if (Array.isArray(node.marks)) {
      node.marks.forEach((mark, index) => {
        if (mark && typeof mark === "object") visitColor((mark as { color?: unknown }).color, [...path, "marks", index, "color"]);
      });
    }
    if (node.type === "instance" && node.overrides && typeof node.overrides === "object") {
      for (const [key, override] of Object.entries(node.overrides as Record<string, unknown>)) {
        visitStyle(override, [...path, "overrides", key]);
      }
    }
    if (node.type === "frame" && Array.isArray(node.children)) {
      node.children.forEach((child, index) => visitNode(child, [...path, "children", index]));
    }
  };
  document.children.forEach((node, index) => visitNode(node, ["children", index]));
  (document.components ?? []).forEach((component, index) => visitNode(component.node, ["components", index, "node"]));
}

export const documentSchema = z.strictObject({ version: z.literal(1), children: z.array(nodeSchema), palette: z.array(paletteColor).optional(), components: z.array(componentDefinition).optional() }).superRefine(checkUniqueIds).superRefine(checkUniquePaletteIds).superRefine(checkUniqueComponentIds).superRefine(checkComponentReferences).superRefine(checkPaletteReferences);

const internalGeometry = { x: coordinate, y: coordinate, width: dimension, height: dimension, rotation: coordinate, opacity, shadow: shadow.nullable(), blur, widthConstraint: sizeConstraint, heightConstraint: sizeConstraint, animations: z.array(normalizedAnimation) };
const internalNodeSchema: z.ZodType<DocumentNode> = z.lazy(() => z.discriminatedUnion("type", [
  z.strictObject({ id, name, type: z.literal("rectangle"), ...internalGeometry, isMask: z.boolean(), style: normalizedBoxStyle }),
  z.strictObject({ id, name, type: z.literal("ellipse"), ...internalGeometry, isMask: z.boolean(), style: normalizedShapeStyle }),
  z.strictObject({ id, name, type: z.literal("path"), ...internalGeometry, commands: vectorCommands, fillRule, style: normalizedShapeStyle }),
  z.strictObject({ id, name, type: z.literal("image"), ...internalGeometry, style: normalizedImageStyle, source: z.string().max(MAX_IMAGE_SOURCE_LENGTH).regex(IMAGE_SOURCE_PATTERN) }),
  z.strictObject({ id, name, type: z.literal("frame"), ...internalGeometry, style: normalizedBoxStyle, clipContent: z.boolean(), layoutMode, padding: layoutPadding, gap: layoutGap, alignItems: layoutAlignment, justifyContent: layoutJustify, children: z.array(internalNodeSchema) }),
  z.strictObject({ id, name, type: z.literal("text"), ...internalGeometry, content: z.string(), style: normalizedTextStyle, marks: z.array(textMark).optional() }),
  z.strictObject({ id, name, type: z.literal("instance"), ...internalGeometry, componentRef: id, overrides: z.record(z.string(), instanceOverride) }),
]));

const internalComponentDefinition = z.strictObject({ id, name, node: internalNodeSchema });

export const internalDocumentSchema = z.strictObject({ version: z.literal(1), children: z.array(internalNodeSchema), palette: z.array(paletteColor), components: z.array(internalComponentDefinition) }).superRefine(checkUniqueIds).superRefine(checkUniquePaletteIds).superRefine(checkUniqueComponentIds).superRefine(checkComponentReferences).superRefine(checkPaletteReferences);

function normalizeAnimation(input: z.infer<typeof animation>): Animation {
  return {
    ...input,
    delay: input.delay ?? DEFAULT_ANIMATION_DELAY,
    repeat: input.repeat ?? DEFAULT_ANIMATION_REPEAT,
    tracks: input.tracks.map((track) => ({
      ...track,
      keyframes: track.keyframes.map((keyframe) => ({ ...keyframe, easing: keyframe.easing ?? DEFAULT_EASING })),
    })),
  };
}

function normalizeNode(node: WireNode): DocumentNode {
  const common = {
    rotation: normalizeRotation(node.rotation ?? 0),
    opacity: node.opacity ?? 1,
    shadow: node.shadow ?? null,
    blur: node.blur ?? 0,
    widthConstraint: { ...(node.widthConstraint ?? DEFAULT_SIZE_CONSTRAINT) },
    heightConstraint: { ...(node.heightConstraint ?? DEFAULT_SIZE_CONSTRAINT) },
    animations: (node.animations ?? []).map(normalizeAnimation),
  };
  switch (node.type) {
    case "image": return {
      ...node, ...common,
      style: {
        fit: node.style.fit ?? DEFAULT_IMAGE_STYLE.fit,
        focalPoint: node.style.focalPoint ?? { ...DEFAULT_IMAGE_STYLE.focalPoint },
        cornerRadii: node.style.cornerRadii ?? { ...ZERO_CORNER_RADII },
        filters: { ...DEFAULT_IMAGE_FILTERS, ...node.style.filters },
      },
    };
    case "text": return {
      ...node, ...common,
      style: {
        ...node.style,
        fontFamily: node.style.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily,
        fontWeight: node.style.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight,
        lineHeight: node.style.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
        letterSpacing: node.style.letterSpacing ?? DEFAULT_TEXT_STYLE.letterSpacing,
      },
    };
    case "ellipse": return {
      ...node, ...common, isMask: node.isMask ?? false,
      style: { ...node.style, stroke: node.style.stroke ?? null },
    };
    case "path": return {
      ...node, ...common, fillRule: node.fillRule ?? "nonzero",
      style: { ...node.style, stroke: node.style.stroke ?? null },
    };
    case "rectangle": return {
      ...node, ...common, isMask: node.isMask ?? false, style: normalizeBoxStyle(node.style),
    };
    case "frame": return {
      ...node, ...common, style: normalizeBoxStyle(node.style),
      clipContent: node.clipContent ?? true,
      layoutMode: node.layoutMode ?? DEFAULT_LAYOUT_MODE,
      padding: node.padding ?? DEFAULT_LAYOUT_PADDING,
      gap: node.gap ?? DEFAULT_LAYOUT_GAP,
      alignItems: node.alignItems ?? DEFAULT_LAYOUT_ALIGNMENT,
      justifyContent: node.justifyContent ?? DEFAULT_LAYOUT_JUSTIFY,
      children: node.children.map(normalizeNode),
    };
    case "instance": return { ...node, ...common, overrides: node.overrides ?? {} };
  }
}

function normalizeBoxStyle(style: z.infer<typeof boxStyle>) {
  return {
    ...style, stroke: style.stroke ?? null,
    cornerRadii: style.cornerRadii ?? { ...ZERO_CORNER_RADII }, border: style.border ?? {},
  };
}

function compactSize(key: "widthConstraint" | "heightConstraint", constraint: SizeConstraint) {
  if (constraint.mode === "fixed" && constraint.min === undefined && constraint.max === undefined) return {};
  return { [key]: { mode: constraint.mode, ...(constraint.min === undefined ? {} : { min: constraint.min }), ...(constraint.max === undefined ? {} : { max: constraint.max }) } };
}

function compactAnimation(input: Animation): z.infer<typeof animation> {
  return {
    id: input.id, name: input.name, trigger: input.trigger, duration: input.duration,
    ...(input.delay === DEFAULT_ANIMATION_DELAY ? {} : { delay: input.delay }),
    ...(input.repeat === DEFAULT_ANIMATION_REPEAT ? {} : { repeat: input.repeat }),
    tracks: input.tracks.map((track) => ({
      property: track.property,
      keyframes: track.keyframes.map((keyframe) => ({
        time: keyframe.time, value: keyframe.value,
        ...(keyframe.easing === DEFAULT_EASING ? {} : { easing: keyframe.easing }),
      })),
    })),
  };
}

// 内部モデルは呼び出し前に検証済み。ここでは値を修復せず、既定値だけを省略する。
function compactCommonFields(node: DocumentNode): WireCommonFields {
  const rotation = normalizeRotation(node.rotation);
  return {
    id: node.id, name: node.name, x: node.x, y: node.y, width: node.width, height: node.height,
    ...(rotation === 0 ? {} : { rotation }),
    ...(node.opacity === 1 ? {} : { opacity: node.opacity }),
    ...(node.shadow === null ? {} : { shadow: node.shadow }),
    ...(node.blur === 0 ? {} : { blur: node.blur }),
    ...compactSize("widthConstraint", node.widthConstraint),
    ...compactSize("heightConstraint", node.heightConstraint),
    ...(node.animations.length === 0 ? {} : { animations: node.animations.map(compactAnimation) }),
  };
}

function compactShapeStyle(style: z.infer<typeof normalizedShapeStyle>): z.infer<typeof shapeStyle> {
  return { fill: style.fill, ...(style.stroke === null ? {} : { stroke: style.stroke }) };
}

function compactBoxStyle(style: z.infer<typeof normalizedBoxStyle>): z.infer<typeof boxStyle> {
  return {
    ...compactShapeStyle(style),
    ...(Object.values(style.cornerRadii).some((value) => value !== 0) ? { cornerRadii: style.cornerRadii } : {}),
    ...(Object.keys(style.border).length ? { border: style.border } : {}),
  };
}

function compactImageStyle(style: z.infer<typeof normalizedImageStyle>): z.infer<typeof imageStyle> {
  const filters = Object.fromEntries(Object.entries(style.filters)
    .filter(([key, value]) => value !== DEFAULT_IMAGE_FILTERS[key as keyof typeof DEFAULT_IMAGE_FILTERS]));
  return {
    ...(style.fit === DEFAULT_IMAGE_STYLE.fit ? {} : { fit: style.fit }),
    ...(style.focalPoint.x === DEFAULT_IMAGE_STYLE.focalPoint.x && style.focalPoint.y === DEFAULT_IMAGE_STYLE.focalPoint.y
      ? {} : { focalPoint: style.focalPoint }),
    ...(Object.values(style.cornerRadii).some((value) => value !== 0) ? { cornerRadii: style.cornerRadii } : {}),
    ...(Object.keys(filters).length ? { filters } : {}),
  };
}

function compactTextStyle(style: z.infer<typeof normalizedTextStyle>): z.infer<typeof textStyle> {
  const { fontFamily, fontWeight, lineHeight, letterSpacing, ...required } = style;
  return { ...required,
      ...(fontFamily === DEFAULT_TEXT_STYLE.fontFamily ? {} : { fontFamily }),
      ...(fontWeight === DEFAULT_TEXT_STYLE.fontWeight ? {} : { fontWeight }),
      ...(lineHeight === DEFAULT_TEXT_STYLE.lineHeight ? {} : { lineHeight }),
      ...(letterSpacing === DEFAULT_TEXT_STYLE.letterSpacing ? {} : { letterSpacing }),
  };
}

function compactNode(node: DocumentNode): WireNode {
  const common = compactCommonFields(node);
  switch (node.type) {
    case "image": return { ...common, type: "image", source: node.source, style: compactImageStyle(node.style) };
    case "text": return {
      ...common, type: "text", content: node.content, style: compactTextStyle(node.style),
      ...(node.marks === undefined ? {} : { marks: node.marks }),
    };
    case "path": return {
      ...common, type: "path", commands: node.commands, style: compactShapeStyle(node.style),
      ...(node.fillRule === "nonzero" ? {} : { fillRule: node.fillRule }),
    };
    case "ellipse": return {
      ...common, type: "ellipse", style: compactShapeStyle(node.style), ...(node.isMask ? { isMask: true } : {}),
    };
    case "rectangle": return {
      ...common, type: "rectangle", style: compactBoxStyle(node.style), ...(node.isMask ? { isMask: true } : {}),
    };
    case "frame": return {
      ...common, type: "frame", style: compactBoxStyle(node.style),
      ...(node.clipContent ? {} : { clipContent: false }),
      ...(node.layoutMode === DEFAULT_LAYOUT_MODE ? {} : { layoutMode: node.layoutMode }),
      ...(node.padding === DEFAULT_LAYOUT_PADDING ? {} : { padding: node.padding }),
      ...(node.gap === DEFAULT_LAYOUT_GAP ? {} : { gap: node.gap }),
      ...(node.alignItems === DEFAULT_LAYOUT_ALIGNMENT ? {} : { alignItems: node.alignItems }),
      ...(node.justifyContent === DEFAULT_LAYOUT_JUSTIFY ? {} : { justifyContent: node.justifyContent }),
      children: node.children.map(compactNode),
    };
    case "instance": return {
      ...common, type: "instance", componentRef: node.componentRef,
      ...(Object.keys(node.overrides).length === 0 ? {} : { overrides: node.overrides }),
    };
  }
}

const parseJson = Result.fn({
  try: (json: string): unknown => JSON.parse(json),
  catch: (error) => new Error(`JSON を読み取れません: ${error instanceof Error ? error.message : String(error)}`),
});

export function parseDocument(json: string) {
  const parsed = parseJson(json);
  if (Result.isFailure(parsed)) return parsed;
  const validated = Result.parse(documentSchema, parsed.value);
  return Result.isFailure(validated) ? validated : Result.succeed({
    version: 1 as const,
    children: validated.value.children.map(normalizeNode),
    palette: validated.value.palette ?? [],
    components: (validated.value.components ?? []).map((component) => ({ id: component.id, name: component.name, node: normalizeNode(component.node) })),
  });
}

export function serializeDocument(document: Document) {
  const parsed = Result.parse(internalDocumentSchema, document);
  if (Result.isFailure(parsed)) return parsed;
  const wire = Result.parse(documentSchema, {
    version: 1,
    children: parsed.value.children.map(compactNode),
    ...(parsed.value.palette.length === 0 ? {} : { palette: parsed.value.palette }),
    ...(parsed.value.components.length === 0 ? {} : { components: parsed.value.components.map((component) => ({ id: component.id, name: component.name, node: compactNode(component.node) })) }),
  });
  if (Result.isFailure(wire)) return wire;
  return Result.succeed(JSON.stringify(wire.value, null, 2));
}
