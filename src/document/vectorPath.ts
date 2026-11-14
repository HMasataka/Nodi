import type { VectorPathCommand } from "@/document/types.ts";

export const MAX_PATH_COMMANDS = 2048;

export function vectorPathIssue(commands: unknown, fillRule: unknown): string | null {
  if (fillRule !== "nonzero" && fillRule !== "evenodd") return "塗り規則が不正です";
  if (!Array.isArray(commands) || commands.length < 2 || commands.length > MAX_PATH_COMMANDS) return "パス命令は2〜2048個で指定してください";
  let segments = 0;
  let closed = false;
  for (const [index, command] of (commands as VectorPathCommand[]).entries()) {
    if (!command || typeof command !== "object" || Array.isArray(command)) return "パス命令が不正です";
    if (command.kind === "move") {
      if (segments === 0 && index > 0) return "空のサブパスは作成できません";
      segments = 0;
      closed = false;
    } else if (command.kind === "line" || command.kind === "cubic") {
      if (closed || index === 0) return "移動命令の後に線分を指定してください";
      segments++;
    } else if (command.kind === "close") {
      if (closed || segments < 2) return "閉じるパスには2本以上の線分が必要です";
      closed = true;
    } else return "パス命令が不正です";
    const fields = command.kind === "close" ? [] : command.kind === "cubic" ? ["x1", "y1", "x2", "y2", "x", "y"] : ["x", "y"];
    if (Object.keys(command).sort().join() !== ["kind", ...fields].sort().join() || fields.some((field) => !Number.isFinite((command as unknown as Record<string, number>)[field]))) return "パス座標は有限値で指定してください";
  }
  if (commands[0].kind !== "move" || segments === 0) return "パスは移動命令と線分が必要です";
  return null;
}
