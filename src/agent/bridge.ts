import { Result } from "@praha/byethrow";
import type { z } from "zod";

import type { AgentApi } from "@/agent/api.ts";
import { agentInputs } from "@/agent/contracts.ts";

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
      case "get_state": return withInput(agentInputs.get_state, args, () => api.getState());
      case "get_element": return withInput(agentInputs.get_element, args, ({ id }) => api.getElement(id));
      case "select_element": return withInput(agentInputs.select_element, args, ({ id }) => api.select(id));
      case "list_revisions": return withInput(agentInputs.list_revisions, args, () => api.listRevisions());
      case "get_revision_element": return withInput(agentInputs.get_revision_element, args, ({ revisionId, elementId }) => api.getRevisionElement(revisionId, elementId));
      case "compare_revisions": return withInput(agentInputs.compare_revisions, args, ({ fromRevisionId, toRevisionId, elementId }) => api.compareRevisions(fromRevisionId, toRevisionId, elementId));
      case "measure_elements": return withInput(agentInputs.measure_elements, args, ({ revisionId, firstId, secondId }) => api.measureElements(revisionId, firstId, secondId));
      case "add_element": return withInput(agentInputs.add_element, args, (input) => api.add(input));
      case "rename_element": return withInput(agentInputs.rename_element, args, ({ id, name }) => api.rename(id, name));
      case "move_element": return withInput(agentInputs.move_element, args, ({ id, x, y }) => api.move(id, x, y));
      case "set_text_content": return withInput(agentInputs.set_text_content, args, ({ id, content }) => api.setTextContent(id, content));
      case "set_element_geometry": return withInput(agentInputs.set_element_geometry, args, ({ id, ...geometry }) => api.setGeometry(id, geometry));
      case "set_rotation": return withInput(agentInputs.set_rotation, args, ({ id, rotation }) => api.setRotation(id, rotation));
      case "set_opacity": return withInput(agentInputs.set_opacity, args, ({ id, opacity }) => api.setOpacity(id, opacity));
      case "set_shadow": return withInput(agentInputs.set_shadow, args, ({ id, shadow }) => api.setShadow(id, shadow));
      case "set_blur": return withInput(agentInputs.set_blur, args, ({ id, blur }) => api.setBlur(id, blur));
      case "set_mask": return withInput(agentInputs.set_mask, args, ({ id, isMask }) => api.setMask(id, isMask));
      case "set_shape_style": return withInput(agentInputs.set_shape_style, args, ({ id, ...style }) => api.setShapeStyle(id, style));
      case "set_frame_style": return withInput(agentInputs.set_frame_style, args, ({ id, ...style }) => api.setFrameStyle(id, style));
      case "set_border": return withInput(agentInputs.set_border, args, ({ id, border }) => api.setBorder(id, border));
      case "set_image_style": return withInput(agentInputs.set_image_style, args, ({ id, ...style }) => api.setImageStyle(id, style));
      case "set_image_filters": return withInput(agentInputs.set_image_filters, args, ({ id, filters }) => api.setImageFilters(id, filters));
      case "set_text_style": return withInput(agentInputs.set_text_style, args, ({ id, ...style }) => api.setTextStyle(id, style));
      case "set_text_marks": return withInput(agentInputs.set_text_marks, args, ({ id, marks }) => api.setTextMarks(id, marks));
      case "delete_element": return withInput(agentInputs.delete_element, args, ({ id }) => api.delete(id));
      case "duplicate_element": return withInput(agentInputs.duplicate_element, args, ({ id }) => api.duplicate(id));
      default: return Result.fail(new Error(`未知の操作です: ${method}`));
    }
  })();
  return Result.isFailure(result)
    ? { ok: false, error: result.error.message }
    : { ok: true, data: result.value };
}
