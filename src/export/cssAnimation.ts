import { evaluateAnimationLocal } from "@/document/animation.ts";
import type { Animation, Document, DocumentNode } from "@/document/types.ts";

function collectNodes(nodes: DocumentNode[]): DocumentNode[] {
  return nodes.flatMap((node) => [node, ...(node.type === "frame" ? collectNodes(node.children) : [])]);
}

function declarations(values: Partial<Record<"x" | "y" | "scale" | "rotation" | "opacity", number>>): string {
  const parts: string[] = [];
  if (values.x !== undefined || values.y !== undefined) parts.push(`translate: ${values.x ?? 0}px ${values.y ?? 0}px`);
  if (values.rotation !== undefined) parts.push(`rotate: ${values.rotation}deg`);
  if (values.scale !== undefined) parts.push(`scale: ${values.scale}`);
  if (values.opacity !== undefined) parts.push(`opacity: ${values.opacity}`);
  return parts.join("; ");
}

function cssAnimation(node: DocumentNode, animation: Animation): string {
  const times = [...new Set(animation.tracks.flatMap((track) => track.keyframes.map((keyframe) => keyframe.time)))].sort((a, b) => a - b);
  const name = `nodi-${animation.id}`;
  const stops = times.map((time) => {
    const percent = Math.round((time / animation.duration) * 100);
    return `  ${percent}% { ${declarations(evaluateAnimationLocal(animation, time))} }`;
  }).join("\n");
  const easing = animation.tracks[0].keyframes[0].easing;
  const repeat = animation.repeat === 1 ? "1" : String(animation.repeat);
  return `@keyframes ${name} {\n${stops}\n}\n.nodi-${node.id} {\n  animation: ${name} ${animation.duration}ms ${easing} ${animation.delay}ms ${repeat} normal;\n}`;
}

/** 読み込み時（load）アニメーションを CSS の @keyframes と animation 宣言として書き出す。 */
export function exportCssAnimations(document: Document): string {
  const parts: string[] = [];
  for (const node of collectNodes(document.children)) {
    for (const animation of node.animations) {
      if (animation.trigger !== "load") continue;
      parts.push(cssAnimation(node, animation));
    }
  }
  return parts.join("\n\n");
}
