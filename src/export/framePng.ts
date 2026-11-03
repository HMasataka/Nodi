import { resolvedTextFont } from "@/document/textFonts.ts";
import { Result } from "@praha/byethrow";
import { DEFAULT_TEXT_LETTER_SPACING, DEFAULT_TEXT_LINE_HEIGHT, type DocumentNode, type FrameNode } from "@/document/types.ts";

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

export function wrapText(content: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of content.split("\n")) {
    let line = "";
    for (const character of paragraph) {
      if (line && measure(line + character) > width) {
        lines.push(line);
        line = character;
      } else {
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawSpacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: CanvasTextAlign) {
  const characters = [...text];
  const width = ctx.measureText(text).width + characters.length * spacing;
  const left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  ctx.textAlign = "left";
  let prefix = "";
  characters.forEach((character, index) => {
    ctx.fillText(character, left + ctx.measureText(prefix).width + index * spacing, y);
    prefix += character;
  });
}

async function paintNode(ctx: CanvasRenderingContext2D, node: DocumentNode, loadImage: PngRenderEnvironment["loadImage"]): Promise<Result.Result<void, Error>> {
  ctx.save();
  ctx.translate(node.x, node.y);
  try {
    if (node.type === "frame") {
      ctx.fillStyle = node.background;
      ctx.fillRect(0, 0, node.width, node.height);
      if (node.clipContent) {
        ctx.beginPath();
        ctx.rect(0, 0, node.width, node.height);
        ctx.clip();
      }
      for (const child of node.children) {
        const painted = await paintNode(ctx, child, loadImage);
        if (Result.isFailure(painted)) return painted;
      }
    } else if (node.type === "rectangle") {
      const strokeWidth = Math.min(node.strokeWidth, node.width, node.height);
      const inset = strokeWidth / 2;
      ctx.beginPath();
      ctx.roundRect(inset, inset, node.width - strokeWidth, node.height - strokeWidth, Math.max(0, node.cornerRadius - inset));
      ctx.fillStyle = node.fill;
      ctx.fill();
      if (strokeWidth > 0) {
        ctx.strokeStyle = node.stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    } else if (node.type === "ellipse") {
      const strokeWidth = Math.min(node.strokeWidth, node.width, node.height);
      const inset = strokeWidth / 2;
      ctx.beginPath();
      ctx.ellipse(node.width / 2, node.height / 2, Math.max(0, node.width / 2 - inset), Math.max(0, node.height / 2 - inset), 0, 0, Math.PI * 2);
      ctx.fillStyle = node.fill;
      ctx.fill();
      if (strokeWidth > 0) {
        ctx.strokeStyle = node.stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    } else if (node.type === "text") {
      ctx.beginPath();
      ctx.rect(0, 0, node.width, node.height);
      ctx.clip();
      const font = resolvedTextFont(node);
      ctx.font = `${font.fontWeight} ${node.fontSize}px ${font.fontFamily}`;
      ctx.textAlign = node.textAlign;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = node.color;
      const x = node.textAlign === "center" ? node.width / 2 : node.textAlign === "right" ? node.width - 2 : 2;
      const lineHeight = node.fontSize * (node.lineHeight ?? DEFAULT_TEXT_LINE_HEIGHT);
      const letterSpacing = node.letterSpacing ?? DEFAULT_TEXT_LETTER_SPACING;
      const nativeSpacing = "letterSpacing" in ctx;
      if (nativeSpacing) ctx.letterSpacing = `${letterSpacing}px`;
      const metrics = ctx.measureText("Mg");
      const ascent = metrics.fontBoundingBoxAscent ?? node.fontSize;
      const descent = metrics.fontBoundingBoxDescent ?? node.fontSize * 0.35;
      // CSS の 2px padding と設定された行高に合わせて行ボックス内に文字を置く。
      const baseline = 2 + (lineHeight - ascent - descent) / 2 + ascent;
      const measure = (text: string) => ctx.measureText(text).width + (nativeSpacing ? 0 : [...text].length * letterSpacing);
      const lines = wrapText(node.content, node.width - 4, measure);
      lines.forEach((line, index) => {
        const y = baseline + index * lineHeight;
        if (nativeSpacing || letterSpacing === 0) ctx.fillText(line, x, y);
        else drawSpacedText(ctx, line, x, y, letterSpacing, node.textAlign);
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
    ctx.fillStyle = frame.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.clip();
    for (const child of frame.children) {
      const painted = await paintNode(ctx, child, environment.loadImage);
      if (Result.isFailure(painted)) return painted;
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? Result.succeed(blob) : Result.fail(new Error("PNG を生成できません"));
  } catch (error) {
    return Result.fail(new Error(`PNG を生成できません: ${error instanceof Error ? error.message : String(error)}`));
  }
}
