import { Result } from "@praha/byethrow";
import { z } from "zod";
import type { AgentApi } from "@/document/agent.ts";

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

export function dispatchAgentRequest(api: AgentApi, method: string, args: unknown) {
  const input = (() => {
    switch (method) {
      case "get_state": return Result.succeed(api.getState());
      case "get_element": {
        const parsed = idInput.safeParse(args);
        return parsed.success ? Result.succeed(api.getElement(parsed.data.id)) : Result.fail(new Error(parsed.error.issues[0].message));
      }
      case "list_revisions": {
        const parsed = z.strictObject({}).safeParse(args);
        return parsed.success ? Result.succeed(api.listRevisions()) : Result.fail(new Error(parsed.error.issues[0].message));
      }
      case "get_revision_element": {
        const parsed = revisionElementInput.safeParse(args);
        return parsed.success ? Result.succeed(api.getRevisionElement(parsed.data.revisionId, parsed.data.elementId)) : Result.fail(new Error(parsed.error.issues[0].message));
      }
      case "compare_revisions": {
        const parsed = compareInput.safeParse(args);
        return parsed.success ? Result.succeed(api.compareRevisions(parsed.data.fromRevisionId, parsed.data.toRevisionId, parsed.data.elementId)) : Result.fail(new Error(parsed.error.issues[0].message));
      }
      case "measure_elements": {
        const parsed = relativeInput.safeParse(args);
        return parsed.success ? Result.succeed(api.measureElements(parsed.data.revisionId, parsed.data.firstId, parsed.data.secondId)) : Result.fail(new Error(parsed.error.issues[0].message));
      }
      case "add_element": {
        const parsed = addInput.safeParse(args);
        return parsed.success ? Result.succeed(api.add(parsed.data)) : Result.fail(new Error(parsed.error.issues[0].message));
      }
      case "rename_element": {
        const parsed = renameInput.safeParse(args);
        return parsed.success ? Result.succeed(api.rename(parsed.data.id, parsed.data.name)) : Result.fail(new Error(parsed.error.issues[0].message));
      }
      case "move_element": {
        const parsed = moveInput.safeParse(args);
        return parsed.success ? Result.succeed(api.move(parsed.data.id, parsed.data.x, parsed.data.y)) : Result.fail(new Error(parsed.error.issues[0].message));
      }
      case "set_text_content": {
        const parsed = contentInput.safeParse(args);
        return parsed.success ? Result.succeed(api.setTextContent(parsed.data.id, parsed.data.content)) : Result.fail(new Error(parsed.error.issues[0].message));
      }
      default: return Result.fail(new Error(`未知の操作です: ${method}`));
    }
  })();
  if (Result.isFailure(input)) return { ok: false, error: input.error.message };
  const result = input.value;
  return Result.isFailure(result)
    ? { ok: false, error: result.error.message }
    : { ok: true, data: result.value };
}
