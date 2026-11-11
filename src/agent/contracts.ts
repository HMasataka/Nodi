import { z } from "zod";

const id = z.string().min(1);
const idInput = z.strictObject({ id });
const geometry = { x: z.number(), y: z.number(), width: z.number(), height: z.number() };
const cornerRadii = z.strictObject({ topLeft: z.number(), topRight: z.number(), bottomRight: z.number(), bottomLeft: z.number() });
const stroke = z.strictObject({ color: z.string(), width: z.number() });
const unit = z.number().finite().min(0).max(1);
const gradient = z.strictObject({ type: z.literal("linear"), start: z.strictObject({ x: unit, y: unit }), end: z.strictObject({ x: unit, y: unit }),
  stops: z.array(z.strictObject({ position: unit, color: z.string() })).min(2) });
const border = z.strictObject({ top: stroke.optional(), right: stroke.optional(), bottom: stroke.optional(), left: stroke.optional() });
const focalPoint = z.strictObject({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) });
const filters = z.strictObject({ brightness: z.number().finite().nonnegative().optional(), contrast: z.number().finite().nonnegative().optional(),
  saturate: z.number().finite().nonnegative().optional(), grayscale: z.number().finite().min(0).max(1).optional(),
  sepia: z.number().finite().min(0).max(1).optional(), hueRotate: z.number().finite().optional() });
const boxStyle = { fill: z.union([z.string(), gradient]).nullable().optional(), stroke: stroke.nullable().optional(), cornerRadii: cornerRadii.optional() };
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
  ]),
  rename_element: z.strictObject({ id, name: z.string() }),
  move_element: z.strictObject({ id, x: z.number(), y: z.number() }),
  set_text_content: z.strictObject({ id, content: z.string() }),
  set_element_geometry: z.strictObject({ id, ...geometry }),
  set_rotation: z.strictObject({ id, rotation: z.number().finite() }),
  set_opacity: z.strictObject({ id, opacity: z.number().finite().min(0).max(1) }),
  set_mask: z.strictObject({ id, isMask: z.boolean() }),
  set_shape_style: z.strictObject({ id, ...boxStyle }).refine(hasChange, "変更するスタイルを指定してください"),
  set_frame_style: z.strictObject({ id, ...boxStyle, clipContent: z.boolean().optional() }).refine(hasChange, "変更するスタイルを指定してください"),
  set_border: z.strictObject({ id, border }),
  set_image_style: z.strictObject({ id, fit: z.enum(["cover", "contain", "fill"]).optional(), focalPoint: focalPoint.optional(),
    cornerRadii: cornerRadii.optional() }).refine(hasChange, "変更するスタイルを指定してください"),
  set_image_filters: z.strictObject({ id, filters: filters.refine((value) => Object.keys(value).length > 0, "変更するフィルターを指定してください") }),
  set_text_style: z.strictObject({ id, fontSize: z.number().optional(), color: z.string().optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(), fontFamily: z.enum(["default", "system", "serif", "monospace"]).optional(),
    fontWeight: z.number().optional(), lineHeight: z.number().optional(), letterSpacing: z.number().optional() }).refine(hasChange, "変更するスタイルを指定してください"),
  set_text_marks: z.strictObject({ id, marks: z.array(z.strictObject({ start: z.number(), end: z.number(), color: z.string().optional(),
    fontWeight: z.number().optional(), underline: z.literal(true).optional(), code: z.literal(true).optional() })) }),
  delete_element: idInput,
  duplicate_element: idInput,
} as const;
