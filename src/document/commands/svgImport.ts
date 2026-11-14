import { Result } from "@praha/byethrow";

import { addNode } from "@/document/commands/create.ts";
import type { Document } from "@/document/types.ts";
import { findNode } from "@/document/commands/tree.ts";
import type { SvgIcon } from "@/document/svgPath.ts";
import { setFrameStyle, setNodeStyle } from "@/document/commands/style.ts";

export function importSvgIcon(document: Document, input: { icon: SvgIcon; name: string; x: number; y: number; parentId?: string }) {
  const longest = Math.max(input.icon.width, input.icon.height);
  const width = 96 * input.icon.width / longest;
  const height = 96 * input.icon.height / longest;
  const added = addNode(document, { type: "frame", name: input.name, parentId: input.parentId, x: input.x, y: input.y, width, height });
  if (Result.isFailure(added)) return added;
  const frameId = added.value.node.id;
  const transparent = setFrameStyle(added.value.document, frameId, { fill: null });
  if (Result.isFailure(transparent)) return transparent;
  let current = transparent.value;
  for (const [index, item] of input.icon.paths.entries()) {
    const child = addNode(current, { type: "path", name: `${input.name} / パス ${index + 1}`, parentId: frameId,
      x: 0, y: 0, width, height, commands: item.commands, fillRule: item.fillRule });
    if (Result.isFailure(child)) return child;
    const styled = setNodeStyle(child.value.document, child.value.node.id, item.style);
    if (Result.isFailure(styled)) return styled;
    current = styled.value;
  }
  return Result.succeed({ document: current, node: findNode(current, frameId)! });
}
