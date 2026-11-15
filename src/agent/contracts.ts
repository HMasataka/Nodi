import { z } from "zod";

const id = z.string().min(1);
const idInput = z.strictObject({ id });
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/);
const paletteRef = z.strictObject({ type: z.literal("palette"), id });
const color = z.union([hexColor, paletteRef]);
const geometry = { x: z.number(), y: z.number(), width: z.number(), height: z.number() };
const cornerRadii = z.strictObject({ topLeft: z.number(), topRight: z.number(), bottomRight: z.number(), bottomLeft: z.number() });
const stroke = z.strictObject({ color, width: z.number() });
const unit = z.number().finite().min(0).max(1);
const gradient = z.strictObject({ type: z.literal("linear"), start: z.strictObject({ x: unit, y: unit }), end: z.strictObject({ x: unit, y: unit }),
  stops: z.array(z.strictObject({ position: unit, color })).min(2) });
const radialGradient = z.strictObject({ type: z.literal("radial"), center: z.strictObject({ x: unit, y: unit }), radius: unit.positive(),
  stops: z.array(z.strictObject({ position: unit, color })).min(2) });
const border = z.strictObject({ top: stroke.optional(), right: stroke.optional(), bottom: stroke.optional(), left: stroke.optional() });
const focalPoint = z.strictObject({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) });
const filters = z.strictObject({ brightness: z.number().finite().nonnegative().optional(), contrast: z.number().finite().nonnegative().optional(),
  saturate: z.number().finite().nonnegative().optional(), grayscale: z.number().finite().min(0).max(1).optional(),
  sepia: z.number().finite().min(0).max(1).optional(), hueRotate: z.number().finite().optional() });
const boxStyle = { fill: z.union([color, gradient, radialGradient]).nullable().optional(), stroke: stroke.nullable().optional(), cornerRadii: cornerRadii.optional() };
const pathCommands = z.array(z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("move"), x: z.number(), y: z.number() }),
  z.strictObject({ kind: z.literal("line"), x: z.number(), y: z.number() }),
  z.strictObject({ kind: z.literal("cubic"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), x: z.number(), y: z.number() }),
  z.strictObject({ kind: z.literal("close") }),
]));
const pathFillRule = z.enum(["nonzero", "evenodd"]);
const hasChange = (value: { id: string }) => Object.keys(value).some((key) => key !== "id");

export const agentInputs = {
  get_state: z.strictObject({}),
  get_element: idInput,
  select_element: idInput,
  list_revisions: z.strictObject({}),
  get_revision_element: z.strictObject({ revisionId: id, elementId: id }),
  compare_revisions: z.strictObject({ fromRevisionId: id, toRevisionId: id, elementId: id }),
  measure_elements: z.strictObject({ revisionId: id, firstId: id, secondId: id }),
  add_element: z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("rectangle"), name: z.string().optional(), parentId: id.optional(), ...geometry }),
    z.strictObject({ type: z.literal("ellipse"), name: z.string().optional(), parentId: id.optional(), ...geometry }),
    z.strictObject({ type: z.literal("frame"), name: z.string().optional(), parentId: id.optional(), ...geometry }),
    z.strictObject({ type: z.literal("text"), name: z.string().min(1), content: z.string(), parentId: id.optional(), ...geometry }),
    z.strictObject({ type: z.literal("path"), name: z.string().optional(), parentId: id.optional(), ...geometry,
      commands: pathCommands, fillRule: pathFillRule.optional() }),
  ]),
  rename_element: z.strictObject({ id, name: z.string() }),
  move_element: z.strictObject({ id, x: z.number(), y: z.number() }),
  set_text_content: z.strictObject({ id, content: z.string() }),
  set_element_geometry: z.strictObject({ id, ...geometry }),
  set_rotation: z.strictObject({ id, rotation: z.number().finite() }),
  set_opacity: z.strictObject({ id, opacity: z.number().finite().min(0).max(1) }),
  set_shadow: z.strictObject({ id, shadow: z.strictObject({ color, offsetX: z.number().finite(), offsetY: z.number().finite(), blur: z.number().finite().nonnegative() }).nullable() }),
  set_blur: z.strictObject({ id, blur: z.number().finite().nonnegative() }),
  set_mask: z.strictObject({ id, isMask: z.boolean() }),
  set_shape_style: z.strictObject({ id, ...boxStyle }).refine(hasChange, "変更するスタイルを指定してください"),
  set_path: z.strictObject({ id, commands: pathCommands.optional(), fillRule: pathFillRule.optional() }).refine(hasChange, "変更するパスを指定してください"),
  set_frame_style: z.strictObject({ id, ...boxStyle, clipContent: z.boolean().optional() }).refine(hasChange, "変更するスタイルを指定してください"),
  set_frame_layout: z.strictObject({ id, layoutMode: z.enum(["none", "horizontal", "vertical"]).optional(), padding: z.number().finite().nonnegative().optional(), gap: z.number().finite().nonnegative().optional(),
    paddingRef: id.nullable().optional(), gapRef: id.nullable().optional(), alignItems: z.enum(["start", "center", "end"]).optional(),
    justifyContent: z.enum(["start", "center", "end", "space-between"]).optional() }).refine(hasChange, "変更するレイアウトを指定してください"),
  add_spacing_token: z.strictObject({ name: z.string().min(1), value: z.number().finite().nonnegative() }),
  rename_spacing_token: z.strictObject({ id, name: z.string().min(1) }),
  set_spacing_token: z.strictObject({ id, value: z.number().finite().nonnegative() }),
  remove_spacing_token: idInput,
  list_palette: z.strictObject({}),
  add_palette_color: z.strictObject({ name: z.string().min(1), color: hexColor }),
  rename_palette_color: z.strictObject({ id, name: z.string().min(1) }),
  set_palette_color: z.strictObject({ id, color: hexColor }),
  remove_palette_color: idInput,
  duplicate_palette_color: idInput,
  set_border: z.strictObject({ id, border }),
  set_image_style: z.strictObject({ id, fit: z.enum(["cover", "contain", "fill"]).optional(), focalPoint: focalPoint.optional(),
    cornerRadii: cornerRadii.optional() }).refine(hasChange, "変更するスタイルを指定してください"),
  set_image_filters: z.strictObject({ id, filters: filters.refine((value) => Object.keys(value).length > 0, "変更するフィルターを指定してください") }),
  set_text_style: z.strictObject({ id, fontSize: z.number().optional(), color: color.optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(), fontFamily: z.enum(["default", "system", "serif", "monospace"]).optional(),
    fontWeight: z.number().optional(), lineHeight: z.number().optional(), letterSpacing: z.number().optional() }).refine(hasChange, "変更するスタイルを指定してください"),
  set_text_marks: z.strictObject({ id, marks: z.array(z.strictObject({ start: z.number(), end: z.number(), color: color.optional(),
    fontWeight: z.number().optional(), underline: z.literal(true).optional(), code: z.literal(true).optional() })) }),
  delete_element: idInput,
  duplicate_element: idInput,
  list_components: z.strictObject({}),
  create_component: z.strictObject({ sourceId: id, name: z.string().min(1) }),
  rename_component: z.strictObject({ id, name: z.string().min(1) }),
  remove_component: idInput,
  duplicate_component: idInput,
  add_instance: z.strictObject({ componentRef: id, name: z.string().optional(), parentId: id.optional(), x: z.number(), y: z.number(), width: z.number().finite().positive().optional(), height: z.number().finite().positive().optional() }),
  set_instance_override: z.strictObject({ id, childId: id, content: z.string().optional(),
    fill: z.union([z.string(), gradient, radialGradient]).nullable().optional(), stroke: stroke.nullable().optional(), color: z.string().optional(),
    source: z.string().optional(), width: z.number().finite().positive().optional(), height: z.number().finite().positive().optional() })
    .refine((value) => ["content", "fill", "stroke", "color", "source", "width", "height"].some((key) => key in value), "変更する属性を指定してください"),
  reset_instance_override: z.strictObject({ id, childId: id }),
  detach_instance: idInput,
} as const;
