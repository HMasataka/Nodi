import { blurPixels } from "@/document/blur.ts";
import { graphemeSegments } from "@/document/textLayout.ts";
import { imagePlacement } from "@/document/imagePlacement.ts";
import { RENDER_COLORS } from "@/rendering/colors.ts";
import { resolveDocumentLayout } from "@/document/layout.ts";
import { Result } from "@praha/byethrow";
import type { Border, DocumentNode, FrameNode } from "@/document/types.ts";
import { borderPaths, boxShape, ellipseShape, roundedRectPath, type ShapePaths, tracePath, vectorShape } from "@/document/shapePath.ts";
import { createLayoutMeasure, layoutTextLines, textFragmentStyle } from "@/rendering/textLayout.ts";
import { filterPixels, hasImageFilters } from "@/document/imageFilters.ts";
import { maskGroups, maskPath } from "@/document/masks.ts";

export interface PngRenderEnvironment {
  createCanvas(): HTMLCanvasElement;
  loadImage(source: string): Promise<HTMLImageElement>;
}

const browserEnvironment: PngRenderEnvironment = {
  createCanvas: () => document.createElement("canvas"),
  loadImage: async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    return image;
  },
};

function drawSpacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: CanvasTextAlign) {
  const characters = graphemeSegments(text);
  const width = ctx.measureText(text).width + characters.length * spacing;
  const left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  ctx.textAlign = "left";
  let prefix = "";
  characters.forEach((character, index) => {
    ctx.fillText(character, left + ctx.measureText(prefix).width + index * spacing, y);
    prefix += character;
  });
}

function paintShape(ctx: CanvasRenderingContext2D, shape: ShapePaths, width: number, height: number) {
  if (shape.fillColor !== null) {
    tracePath(ctx, shape.fill);
    if (typeof shape.fillColor === "string") ctx.fillStyle = shape.fillColor;
    else {
      const fill = shape.fillColor;
      const gradient = fill.type === "linear"
        ? ctx.createLinearGradient(fill.start.x * width, fill.start.y * height, fill.end.x * width, fill.end.y * height)
        : ctx.createRadialGradient(fill.center.x * width, fill.center.y * height, 0,
          fill.center.x * width, fill.center.y * height, fill.radius * Math.min(width, height));
      fill.stops.forEach((stop) => gradient.addColorStop(stop.position, stop.color));
      ctx.fillStyle = gradient;
    }
    ctx.fill(shape.fillRule ?? "nonzero");
  }
  if (shape.stroke) {
    tracePath(ctx, shape.stroke);
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
    ctx.stroke();
  }
}

function paintBorder(ctx: CanvasRenderingContext2D, width: number, height: number, border: Border) {
  for (const edge of borderPaths(width, height, border)) {
    tracePath(ctx, edge.commands);
    ctx.fillStyle = edge.color;
    ctx.fill();
  }
}

async function paintChildren(ctx: CanvasRenderingContext2D, nodes: DocumentNode[], environment: PngRenderEnvironment): Promise<Result.Result<void, Error>> {
  for (const group of maskGroups(nodes)) {
    if (group.mask) {
      ctx.save();
      tracePath(ctx, maskPath(group.mask));
      ctx.clip();
    }
    try {
      for (const child of group.children) {
        const painted = await paintNode(ctx, child, environment);
        if (Result.isFailure(painted)) return painted;
      }
    } finally {
      if (group.mask) ctx.restore();
    }
  }
  return Result.succeed();
}

async function paintNode(ctx: CanvasRenderingContext2D, node: DocumentNode, environment: PngRenderEnvironment): Promise<Result.Result<void, Error>> {
  if (node.opacity === 0) return Result.succeed();
  if (node.opacity < 1 || node.shadow || node.blur > 0) {
    // 描画済みのグループをぼかしてから影を付け、最後に透明度を一度だけ掛ける。
    // 画面外の投影元やぼかしの縁が失われないように余白を設ける。
    const padding = Math.ceil(node.blur * 3 + (node.shadow
      ? Math.abs(node.shadow.offsetX) + Math.abs(node.shadow.offsetY) + node.shadow.blur * 3 : 0) + (node.blur > 0 || node.shadow ? 2 : 0));
    const layer = environment.createCanvas();
    layer.width = ctx.canvas.width + padding * 2;
    layer.height = ctx.canvas.height + padding * 2;
    const layerContext = layer.getContext("2d");
    if (!layerContext) return Result.fail(new Error("不透明度の描画領域を作成できません"));
    const transform = ctx.getTransform();
    layerContext.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e + padding, transform.f + padding);
    const painted = await paintNode(layerContext, { ...node, opacity: 1, shadow: null, blur: 0 }, environment);
    if (Result.isFailure(painted)) return painted;
    if (node.blur > 0) {
      const pixels = layerContext.getImageData(0, 0, layer.width, layer.height);
      pixels.data.set(blurPixels(pixels.data, layer.width, layer.height, node.blur));
      layerContext.putImageData(pixels, 0, 0);
    }
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (node.shadow) {
        const angle = node.rotation * Math.PI / 180;
        const x = node.shadow.offsetX * Math.cos(angle) - node.shadow.offsetY * Math.sin(angle);
        const y = node.shadow.offsetX * Math.sin(angle) + node.shadow.offsetY * Math.cos(angle);
        const offsetX = Number((x * transform.a + y * transform.c).toFixed(6));
        const offsetY = Number((x * transform.b + y * transform.d).toFixed(6));
        ctx.filter = `drop-shadow(${offsetX}px ${offsetY}px ${node.shadow.blur}px ${node.shadow.color})`;
      }
      ctx.globalAlpha *= node.opacity;
      ctx.drawImage(layer, -padding, -padding);
    } finally {
      ctx.restore();
    }
    return Result.succeed();
  }
  ctx.save();
  ctx.translate(node.x, node.y);
  if (node.rotation !== 0) {
    ctx.translate(node.width / 2, node.height / 2);
    ctx.rotate(node.rotation * Math.PI / 180);
    ctx.translate(-node.width / 2, -node.height / 2);
  }
  try {
    if (node.type === "frame") {
      const shape = boxShape(node.width, node.height, node.style);
      paintShape(ctx, shape, node.width, node.height);
      if (node.clipContent) {
        tracePath(ctx, shape.fill);
        ctx.clip();
      }
      const painted = await paintChildren(ctx, node.children, environment);
      if (Result.isFailure(painted)) return painted;
      paintBorder(ctx, node.width, node.height, node.style.border);
    } else if (node.type === "rectangle") {
      paintShape(ctx, boxShape(node.width, node.height, node.style), node.width, node.height);
      paintBorder(ctx, node.width, node.height, node.style.border);
    } else if (node.type === "ellipse") {
      paintShape(ctx, ellipseShape(node.width, node.height, node.style), node.width, node.height);
    } else if (node.type === "path") {
      paintShape(ctx, vectorShape(node), node.width, node.height);
    } else if (node.type === "text") {
      ctx.beginPath();
      ctx.rect(0, 0, node.width, node.height);
      ctx.clip();
      const { lines, nativeSpacing, letterSpacing } = layoutTextLines(ctx, node);
      ctx.textAlign = node.style.textAlign;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = node.style.color;
      const x = node.style.textAlign === "center" ? node.width / 2 : node.style.textAlign === "right" ? node.width - 2 : 2;
      const lineHeight = node.style.fontSize * node.style.lineHeight;
      const metrics = ctx.measureText("Mg");
      const ascent = metrics.fontBoundingBoxAscent ?? node.style.fontSize;
      const descent = metrics.fontBoundingBoxDescent ?? node.style.fontSize * 0.35;
      // CSS の 2px padding と設定された行高に合わせて行ボックス内に文字を置く。
      const baseline = 2 + (lineHeight - ascent - descent) / 2 + ascent;
      lines.forEach((line, index) => {
        const y = baseline + index * lineHeight;
        ctx.textAlign = node.style.textAlign;
        if (line.fragments.length === 0) { ctx.fillText("", x, y); return; }
        if (line.fragments.length === 1 && !line.fragments[0].mark) {
          const text = line.fragments[0].text;
          if (nativeSpacing || letterSpacing === 0) ctx.fillText(text, x, y);
          else drawSpacedText(ctx, text, x, y, letterSpacing, node.style.textAlign);
          return;
        }
        let left = node.style.textAlign === "center" ? (node.width - line.width) / 2
          : node.style.textAlign === "right" ? node.width - 2 - line.width : 2;
        for (const fragment of line.fragments) {
          const appearance = textFragmentStyle(node, fragment.mark);
          ctx.font = `${appearance.fontWeight} ${node.style.fontSize}px ${appearance.fontFamily}`;
          ctx.textAlign = "left";
          if (appearance.code) {
            const bounds = ctx.measureText("Mg");
            const ascent = bounds.fontBoundingBoxAscent ?? node.style.fontSize;
            const descent = bounds.fontBoundingBoxDescent ?? node.style.fontSize * 0.35;
            ctx.beginPath();
            ctx.roundRect(left, y - ascent, fragment.width, ascent + descent, 3);
            ctx.fillStyle = RENDER_COLORS.codeBackground;
            ctx.fill();
          }
          ctx.fillStyle = appearance.color;
          if (nativeSpacing || letterSpacing === 0) ctx.fillText(fragment.text, left, y);
          else drawSpacedText(ctx, fragment.text, left, y, letterSpacing, "left");
          if (appearance.underline) {
            ctx.beginPath();
            ctx.moveTo(left, y + 2);
            ctx.lineTo(left + fragment.width, y + 2);
            ctx.strokeStyle = appearance.color;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          left += fragment.width;
        }
      });
    } else {
      tracePath(ctx, roundedRectPath(0, 0, node.width, node.height, node.style.cornerRadii));
      ctx.clip();
      const image = await environment.loadImage(node.source);
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (width === 0 || height === 0) return Result.fail(new Error(`画像を描画できません: ${node.name}`));
      const { sx, sy, sw, sh, dx, dy, dw, dh } = imagePlacement(width, height, node.width, node.height, node.style);
      if (node.style.fit === "contain") {
        ctx.fillStyle = "#eeeeee";
        ctx.fillRect(0, 0, node.width, node.height);
      }
      if (hasImageFilters(node.style.filters)) {
        const filtered = environment.createCanvas();
        filtered.width = Math.max(1, Math.round(node.width));
        filtered.height = Math.max(1, Math.round(node.height));
        const offscreen = filtered.getContext("2d", { willReadFrequently: true });
        if (!offscreen) return Result.fail(new Error("画像フィルターの描画領域を作成できません"));
        offscreen.scale(filtered.width / node.width, filtered.height / node.height);
        offscreen.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
        const pixels = offscreen.getImageData(0, 0, filtered.width, filtered.height);
        pixels.data.set(filterPixels(pixels.data, node.style.filters));
        offscreen.putImageData(pixels, 0, 0);
        ctx.drawImage(filtered, 0, 0, node.width, node.height);
      } else ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    return Result.succeed();
  } finally {
    ctx.restore();
  }
}

export async function renderFramePng(frame: FrameNode, environment: PngRenderEnvironment = browserEnvironment): Promise<Result.Result<Blob, Error>> {
  try {
    const canvas = environment.createCanvas();
    canvas.width = Math.round(frame.width);
    canvas.height = Math.round(frame.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return Result.fail(new Error("PNG の描画領域を作成できません"));
    // 編集画面と同じ座標解決エンジンを通し、自動レイアウトを解決してから描画する。
    const resolved = resolveDocumentLayout({ version: 1, children: [{ ...frame, x: 0, y: 0 }] },
      { measure: createLayoutMeasure(ctx) }).children[0] as FrameNode;
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.clip();
    const painted = await paintNode(ctx, resolved, environment);
    if (Result.isFailure(painted)) return painted;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? Result.succeed(blob) : Result.fail(new Error("PNG を生成できません"));
  } catch (error) {
    return Result.fail(new Error(`PNG を生成できません: ${error instanceof Error ? error.message : String(error)}`));
  }
}
