import { Result } from "@praha/byethrow";
import { z } from "zod";

import type { AgentApi } from "@/agent/api.ts";
import { TEXT_FONT_FAMILIES } from "@/document/types.ts";

const idInput = z.strictObject({ id: z.string().min(1) });
const geometryInput = {
  x: z.number(), y: z.number(), width: z.number(), height: z.number(),
};
const addInput = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("frame"), name: z.string().optional(), parentId: z.string().optional(), ...geometryInput }),
  z.strictObject({ type: z.literal("rectangle"), name: z.string().optional(), parentId: z.string().optional(), ...geometryInput }),
  z.strictObject({ type: z.literal("ellipse"), name: z.string().optional(), parentId: z.string().optional(), ...geometryInput }),
  z.strictObject({ type: z.literal("text"), name: z.string().min(1), content: z.string(), parentId: z.string().optional(), ...geometryInput }),
]);
const renameInput = z.strictObject({ id: z.string().min(1), name: z.string() });
const moveInput = z.strictObject({ id: z.string().min(1), x: z.number(), y: z.number() });
const contentInput = z.strictObject({ id: z.string().min(1), content: z.string() });
const revisionElementInput = z.strictObject({ revisionId: z.string().min(1), elementId: z.string().min(1) });
const compareInput = z.strictObject({ fromRevisionId: z.string().min(1), toRevisionId: z.string().min(1), elementId: z.string().min(1) });
const relativeInput = z.strictObject({ revisionId: z.string().min(1), firstId: z.string().min(1), secondId: z.string().min(1) });
const setGeometryInput = z.strictObject({ id: z.string().min(1), ...geometryInput });
const rotationInput = z.strictObject({ id: z.string().min(1), rotation: z.number().finite() });
const hasChange = (value: { id: string }) => Object.keys(value).some((key) => key !== "id");
const boxStyleInput = { fill: z.string().nullable().optional(), stroke: z.strictObject({ color: z.string(), width: z.number() }).nullable().optional(), cornerRadii: z.strictObject({ topLeft: z.number(), topRight: z.number(), bottomRight: z.number(), bottomLeft: z.number() }).optional() };
const borderEdge = z.strictObject({ color: z.string(), width: z.number() });
const borderInput = z.strictObject({ top: borderEdge.optional(), right: borderEdge.optional(), bottom: borderEdge.optional(), left: borderEdge.optional() });
const setBorderInput = z.strictObject({ id: z.string().min(1), border: borderInput });
const shapeStyleInput = z.strictObject({ id: z.string().min(1), ...boxStyleInput }).refine(hasChange, "変更するスタイルを指定してください");
const frameStyleInput = z.strictObject({ id: z.string().min(1), ...boxStyleInput, clipContent: z.boolean().optional() }).refine(hasChange, "変更するスタイルを指定してください");
const imageStyleInput = z.strictObject({ id: z.string().min(1), fit: z.enum(["cover", "contain", "fill"]).optional(), focalPoint: z.strictObject({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).optional(), cornerRadii: boxStyleInput.cornerRadii }).refine(hasChange, "変更するスタイルを指定してください");
const textStyleInput = z.strictObject({ id: z.string().min(1), fontSize: z.number().optional(), color: z.string().optional(), textAlign: z.enum(["left", "center", "right"]).optional(), fontFamily: z.enum(TEXT_FONT_FAMILIES).optional(), fontWeight: z.number().optional(), lineHeight: z.number().optional(), letterSpacing: z.number().optional() }).refine(hasChange, "変更するスタイルを指定してください");
const textMarksInput = z.strictObject({ id: z.string().min(1), marks: z.array(z.strictObject({ start: z.number(), end: z.number(), color: z.string().optional(), fontWeight: z.number().optional(), underline: z.literal(true).optional(), code: z.literal(true).optional() })) });
const emptyInput = z.strictObject({});

function withInput<Input, Output>(
  schema: z.ZodType<Input>,
  args: unknown,
  action: (input: Input) => Result.Result<Output, Error>,
): Result.Result<Output, Error> {
  const parsed = schema.safeParse(args);
  return parsed.success ? action(parsed.data) : Result.fail(new Error(parsed.error.issues[0].message));
}

export function dispatchAgentRequest(api: AgentApi, method: string, args: unknown) {
  const result = (() => {
    switch (method) {
      case "get_state": return api.getState();
      case "get_element": return withInput(idInput, args, ({ id }) => api.getElement(id));
      case "select_element": return withInput(idInput, args, ({ id }) => api.select(id));
      case "list_revisions": return withInput(emptyInput, args, () => api.listRevisions());
      case "get_revision_element": return withInput(revisionElementInput, args, ({ revisionId, elementId }) => api.getRevisionElement(revisionId, elementId));
      case "compare_revisions": return withInput(compareInput, args, ({ fromRevisionId, toRevisionId, elementId }) => api.compareRevisions(fromRevisionId, toRevisionId, elementId));
      case "measure_elements": return withInput(relativeInput, args, ({ revisionId, firstId, secondId }) => api.measureElements(revisionId, firstId, secondId));
      case "add_element": return withInput(addInput, args, (input) => api.add(input));
      case "rename_element": return withInput(renameInput, args, ({ id, name }) => api.rename(id, name));
      case "move_element": return withInput(moveInput, args, ({ id, x, y }) => api.move(id, x, y));
      case "set_text_content": return withInput(contentInput, args, ({ id, content }) => api.setTextContent(id, content));
      case "set_element_geometry": return withInput(setGeometryInput, args, ({ id, ...geometry }) => api.setGeometry(id, geometry));
      case "set_rotation": return withInput(rotationInput, args, ({ id, rotation }) => api.setRotation(id, rotation));
      case "set_shape_style": return withInput(shapeStyleInput, args, ({ id, ...style }) => api.setShapeStyle(id, style));
      case "set_frame_style": return withInput(frameStyleInput, args, ({ id, ...style }) => api.setFrameStyle(id, style));
      case "set_border": return withInput(setBorderInput, args, ({ id, border }) => api.setBorder(id, border));
      case "set_image_style": return withInput(imageStyleInput, args, ({ id, ...style }) => api.setImageStyle(id, style));
      case "set_text_style": return withInput(textStyleInput, args, ({ id, ...style }) => api.setTextStyle(id, style));
      case "set_text_marks": return withInput(textMarksInput, args, ({ id, marks }) => api.setTextMarks(id, marks));
      case "delete_element": return withInput(idInput, args, ({ id }) => api.delete(id));
      case "duplicate_element": return withInput(idInput, args, ({ id }) => api.duplicate(id));
      default: return Result.fail(new Error(`未知の操作です: ${method}`));
    }
  })();
  return Result.isFailure(result)
    ? { ok: false, error: result.error.message }
    : { ok: true, data: result.value };
}
