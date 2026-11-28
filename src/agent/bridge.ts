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
      case "set_visible": return withInput(agentInputs.set_visible, args, ({ id, visible }) => api.setVisible(id, visible));
      case "set_shape_style": return withInput(agentInputs.set_shape_style, args, ({ id, ...style }) => api.setShapeStyle(id, style));
      case "set_path": return withInput(agentInputs.set_path, args, ({ id, ...path }) => api.setPath(id, path));
      case "set_frame_style": return withInput(agentInputs.set_frame_style, args, ({ id, ...style }) => api.setFrameStyle(id, style));
      case "set_frame_layout": return withInput(agentInputs.set_frame_layout, args, ({ id, ...patch }) => api.setFrameLayout(id, patch));
      case "add_spacing_token": return withInput(agentInputs.add_spacing_token, args, ({ name, value }) => api.addSpacingToken(name, value));
      case "rename_spacing_token": return withInput(agentInputs.rename_spacing_token, args, ({ id, name }) => api.changeSpacingToken(id, { name }));
      case "set_spacing_token": return withInput(agentInputs.set_spacing_token, args, ({ id, value }) => api.changeSpacingToken(id, { value }));
      case "remove_spacing_token": return withInput(agentInputs.remove_spacing_token, args, ({ id }) => api.changeSpacingToken(id, { remove: true }));
      case "list_palette": return withInput(agentInputs.list_palette, args, () => api.listPalette());
      case "add_palette_color": return withInput(agentInputs.add_palette_color, args, ({ name, color }) => api.addPaletteColor({ name, color }));
      case "rename_palette_color": return withInput(agentInputs.rename_palette_color, args, ({ id, name }) => api.changePaletteColor(id, { name }));
      case "set_palette_color": return withInput(agentInputs.set_palette_color, args, ({ id, color }) => api.changePaletteColor(id, { color }));
      case "remove_palette_color": return withInput(agentInputs.remove_palette_color, args, ({ id }) => api.changePaletteColor(id, { remove: true }));
      case "duplicate_palette_color": return withInput(agentInputs.duplicate_palette_color, args, ({ id }) => api.changePaletteColor(id, { duplicate: true }));
      case "list_themes": return withInput(agentInputs.list_themes, args, () => api.listThemes());
      case "set_themes": return withInput(agentInputs.set_themes, args, ({ themes }) => api.setThemes(themes));
      case "rename_theme": return withInput(agentInputs.rename_theme, args, ({ from, to }) => api.renameTheme(from, to));
      case "set_palette_theme_color": return withInput(agentInputs.set_palette_theme_color, args, ({ id, theme, color }) => api.setPaletteThemeColor(id, theme, color));
      case "set_frame_theme": return withInput(agentInputs.set_frame_theme, args, ({ id, theme }) => api.setFrameTheme(id, theme));
      case "set_border": return withInput(agentInputs.set_border, args, ({ id, border }) => api.setBorder(id, border));
      case "set_image_style": return withInput(agentInputs.set_image_style, args, ({ id, ...style }) => api.setImageStyle(id, style));
      case "set_image_filters": return withInput(agentInputs.set_image_filters, args, ({ id, filters }) => api.setImageFilters(id, filters));
      case "set_text_style": return withInput(agentInputs.set_text_style, args, ({ id, ...style }) => api.setTextStyle(id, style));
      case "set_text_marks": return withInput(agentInputs.set_text_marks, args, ({ id, marks }) => api.setTextMarks(id, marks));
      case "delete_element": return withInput(agentInputs.delete_element, args, ({ id }) => api.delete(id));
      case "duplicate_element": return withInput(agentInputs.duplicate_element, args, ({ id }) => api.duplicate(id));
      case "list_components": return withInput(agentInputs.list_components, args, () => api.listComponents());
      case "create_component": return withInput(agentInputs.create_component, args, ({ sourceId, name }) => api.createComponent(sourceId, name));
      case "rename_component": return withInput(agentInputs.rename_component, args, ({ id, name }) => api.renameComponent(id, name));
      case "remove_component": return withInput(agentInputs.remove_component, args, ({ id }) => api.removeComponent(id));
      case "duplicate_component": return withInput(agentInputs.duplicate_component, args, ({ id }) => api.duplicateComponent(id));
      case "add_instance": return withInput(agentInputs.add_instance, args, (input) => api.addInstance(input));
      case "set_instance_override": return withInput(agentInputs.set_instance_override, args, ({ id, childId, ...patch }) => api.setInstanceOverride(id, childId, patch));
      case "reset_instance_override": return withInput(agentInputs.reset_instance_override, args, ({ id, childId }) => api.resetInstanceOverride(id, childId));
      case "detach_instance": return withInput(agentInputs.detach_instance, args, ({ id }) => api.detachInstance(id));
      case "set_component_slot": return withInput(agentInputs.set_component_slot, args, ({ componentId, nodeId, slot }) => api.setComponentSlot(componentId, nodeId, slot));
      case "fill_slot": return withInput(agentInputs.fill_slot, args, ({ id, slotId, nodeIds }) => api.fillSlot(id, slotId, nodeIds));
      case "reset_slot": return withInput(agentInputs.reset_slot, args, ({ id, slotId }) => api.resetSlot(id, slotId));
      default: return Result.fail(new Error(`未知の操作です: ${method}`));
    }
  })();
  return Result.isFailure(result)
    ? { ok: false, error: result.error.message }
    : { ok: true, data: result.value };
}
