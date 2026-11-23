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
  // 確認用HTMLでもグラデーションの塗りを描く。線形は始点から終点への向き、放射状は中心と半径で描く。
  function background(fill) {
    if (fill?.type === "linear") {
      const angle = Math.atan2(fill.end.y - fill.start.y, fill.end.x - fill.start.x) * 180 / Math.PI + 90;
      return `linear-gradient(${angle}deg, ${fill.stops.map((stop) => `${color(stop.color)} ${stop.position * 100}%`).join(", ")})`;
    }
    if (fill?.type === "radial") {
      return `radial-gradient(circle at ${fill.center.x * 100}% ${fill.center.y * 100}%, ${fill.stops.map((stop) => `${color(stop.color)} ${stop.position * fill.radius * 100}%`).join(", ")})`;
    }
    return color(fill);
  }
  function render(node) {
    const box = `position:absolute;box-sizing:border-box;left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;opacity:${node.opacity ?? 1};`;
    if (node.type === "text") return `<div style="${box}padding:2px;white-space:pre-wrap;font-size:${node.style.fontSize}px;line-height:${node.style.lineHeight};font-weight:${node.style.fontWeight};color:${color(node.style.color)};text-align:${node.style.textAlign}">${escape(node.content)}</div>`;
    if (node.type === "path") {
      const point = (x, y) => `${x * node.width} ${y * node.height}`;
      const path = node.commands.map((c) => c.kind === "close" ? "Z" : c.kind === "cubic" ? `C${point(c.x1, c.y1)} ${point(c.x2, c.y2)} ${point(c.x, c.y)}` : `${c.kind === "move" ? "M" : "L"}${point(c.x, c.y)}`).join(" ");
      return `<svg style="${box}overflow:visible" viewBox="0 0 ${node.width} ${node.height}"><path d="${path}" fill="${color(node.style.fill)}" stroke="${color(node.style.stroke?.color)}" stroke-width="${node.style.stroke?.width ?? 0}"/></svg>`;
    }
    const radius = node.type === "ellipse" ? "border-radius:50%;" : node.style?.cornerRadii ? `border-radius:${node.style.cornerRadii.topLeft}px ${node.style.cornerRadii.topRight}px ${node.style.cornerRadii.bottomRight}px ${node.style.cornerRadii.bottomLeft}px;` : "";
    const sides = Object.entries(node.style?.border ?? {}).map(([side, stroke]) => `border-${side}:${stroke.width}px solid ${color(stroke.color)};`).join("");
    return `<div style="${box}background:${background(node.style?.fill)};${radius}${sides}${node.style?.stroke ? `border:${node.style.stroke.width}px solid ${color(node.style.stroke.color)};` : ""}">${node.type === "frame" ? node.children.map(render).join("") : ""}</div>`;
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Nodi design review</title><style>body{margin:0;padding:32px;background:#d4d4d4;font-family:Arial,'Hiragino Kaku Gothic ProN',sans-serif}section{margin:0 0 40px}h2{font-size:14px;font-weight:500;margin:0 0 12px}.screen{position:relative;width:1440px;height:960px;background:white;overflow:hidden}</style>${document.children.map((node) => `<section id="${node.id}"><h2>${escape(node.name)}</h2><div class="screen" style="width:${node.width}px;height:${node.height}px;background:${color(node.style?.fill) ?? "white"}">${node.children.map(render).join("")}</div></section>`).join("")}`;
  writeFileSync(new URL("../.local/nodi-design-preview.html", import.meta.url), html);
} finally { await server.close(); }
