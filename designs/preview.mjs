import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true, hmr: false } });
try {
  const { parseDocument } = await server.ssrLoadModule("/src/persistence/format.ts");
  const { resolveDocumentInstances } = await server.ssrLoadModule("/src/document/instances.ts");
  const { resolveDocumentLayout } = await server.ssrLoadModule("/src/document/layout.ts");
  const parsed = parseDocument(readFileSync(new URL("./nodi.nodi", import.meta.url), "utf8"));
  if (parsed.type === "Failure") throw parsed.error;
  const document = resolveDocumentLayout(resolveDocumentInstances(parsed.value));
  const colors = new Map(document.palette.map((item) => [item.id, item.color]));
  const color = (value) => typeof value === "string" ? value : value?.type === "palette" ? colors.get(value.id) : "transparent";
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  function render(node) {
    const box = `position:absolute;box-sizing:border-box;left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;opacity:${node.opacity ?? 1};`;
    if (node.type === "text") return `<div style="${box}padding:2px;white-space:pre-wrap;font-size:${node.style.fontSize}px;line-height:${node.style.lineHeight};font-weight:${node.style.fontWeight};color:${color(node.style.color)};text-align:${node.style.textAlign}">${escape(node.content)}</div>`;
    if (node.type === "path") {
      const path = node.commands.map((c) => c.kind === "close" ? "Z" : `${c.kind === "move" ? "M" : "L"}${c.x * node.width} ${c.y * node.height}`).join(" ");
      return `<svg style="${box}overflow:visible" viewBox="0 0 ${node.width} ${node.height}"><path d="${path}" fill="${color(node.style.fill)}" stroke="${color(node.style.stroke?.color)}" stroke-width="${node.style.stroke?.width ?? 0}"/></svg>`;
    }
    const radius = node.type === "ellipse" ? "border-radius:50%;" : node.style?.cornerRadii ? `border-radius:${node.style.cornerRadii.topLeft}px ${node.style.cornerRadii.topRight}px ${node.style.cornerRadii.bottomRight}px ${node.style.cornerRadii.bottomLeft}px;` : "";
    const sides = Object.entries(node.style?.border ?? {}).map(([side, stroke]) => `border-${side}:${stroke.width}px solid ${color(stroke.color)};`).join("");
    return `<div style="${box}background:${color(node.style?.fill)};${radius}${sides}${node.style?.stroke ? `border:${node.style.stroke.width}px solid ${color(node.style.stroke.color)};` : ""}">${node.type === "frame" ? node.children.map(render).join("") : ""}</div>`;
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Nodi design review</title><style>body{margin:0;padding:32px;background:#d4d4d4;font-family:Arial,'Hiragino Kaku Gothic ProN',sans-serif}section{margin:0 0 40px}h2{font-size:14px;font-weight:500;margin:0 0 12px}.screen{position:relative;width:1440px;height:960px;background:white;overflow:hidden}</style>${document.children.map((node) => `<section id="${node.id}"><h2>${escape(node.name)}</h2><div class="screen" style="width:${node.width}px;height:${node.height}px;background:${color(node.style?.fill) ?? "white"}">${node.children.map(render).join("")}</div></section>`).join("")}`;
  writeFileSync(new URL("../.local/nodi-design-preview.html", import.meta.url), html);
} finally { await server.close(); }
