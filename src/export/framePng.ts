import { graphemeSegments } from "@/document/textLayout.ts";
import { RENDER_COLORS } from "@/rendering/colors.ts";
import { Result } from "@praha/byethrow";
import type { Border, DocumentNode, FrameNode } from "@/document/types.ts";
import { borderPaths, boxShape, ellipseShape, type ShapePaths, tracePath } from "@/document/shapePath.ts";
import { layoutTextLines, textFragmentStyle } from "@/rendering/textLayout.ts";

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

function paintShape(ctx: CanvasRenderingContext2D, shape: ShapePaths) {
  if (shape.fillColor !== null) {
    tracePath(ctx, shape.fill);
    ctx.fillStyle = shape.fillColor;
    ctx.fill();
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

async function paintNode(ctx: CanvasRenderingContext2D, node: DocumentNode, loadImage: PngRenderEnvironment["loadImage"]): Promise<Result.Result<void, Error>> {
  ctx.save();
  ctx.translate(node.x, node.y);
  try {
    if (node.type === "frame") {
      const shape = boxShape(node.width, node.height, node.style);
      paintShape(ctx, shape);
      if (node.clipContent) {
        tracePath(ctx, shape.fill);
        ctx.clip();
      }
      for (const child of node.children) {
        const painted = await paintNode(ctx, child, loadImage);
        if (Result.isFailure(painted)) return painted;
      }
      paintBorder(ctx, node.width, node.height, node.style.border);
    } else if (node.type === "rectangle") {
      paintShape(ctx, boxShape(node.width, node.height, node.style));
      paintBorder(ctx, node.width, node.height, node.style.border);
    } else if (node.type === "ellipse") {
      paintShape(ctx, ellipseShape(node.width, node.height, node.style));
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
      const image = await loadImage(node.source);
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (width === 0 || height === 0) return Result.fail(new Error(`画像を描画できません: ${node.name}`));
      const scale = Math.max(node.width / width, node.height / height);
      const cropWidth = node.width / scale;
      const cropHeight = node.height / scale;
      ctx.drawImage(image, (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, node.width, node.height);
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
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.clip();
    const painted = await paintNode(ctx, { ...frame, x: 0, y: 0 }, environment.loadImage);
    if (Result.isFailure(painted)) return painted;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? Result.succeed(blob) : Result.fail(new Error("PNG を生成できません"));
  } catch (error) {
    return Result.fail(new Error(`PNG を生成できません: ${error instanceof Error ? error.message : String(error)}`));
  }
}
