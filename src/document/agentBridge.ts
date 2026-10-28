import { Result } from "@praha/byethrow";
import { z } from "zod";
import type { AgentApi } from "./agent.ts";

const idInput = z.strictObject({ id: z.string().min(1) });
const addInput = z.strictObject({
  type: z.enum(["frame", "rectangle"]), name: z.string().optional(), parentId: z.string().optional(),
  x: z.number(), y: z.number(), width: z.number(), height: z.number(),
});
const renameInput = z.strictObject({ id: z.string().min(1), name: z.string() });
const moveInput = z.strictObject({ id: z.string().min(1), x: z.number(), y: z.number() });

export function dispatchAgentRequest(api: AgentApi, method: string, args: unknown) {
  const input = (() => {
    switch (method) {
      case "get_state": return Result.succeed(api.getState());
      case "get_element": {
        const parsed = idInput.safeParse(args);
        return parsed.success ? Result.succeed(api.getElement(parsed.data.id)) : Result.fail(new Error(parsed.error.issues[0].message));
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
      default: return Result.fail(new Error(`未知の操作です: ${method}`));
    }
  })();
  if (Result.isFailure(input)) return { ok: false, error: input.error.message };
  const result = input.value;
  return Result.isFailure(result)
    ? { ok: false, error: result.error.message }
    : { ok: true, data: result.value };
}
