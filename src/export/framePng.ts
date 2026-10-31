import { Result } from "@praha/byethrow";
import type { DocumentNode, FrameNode } from "@/document/types.ts";

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
      ctx.beginPath();
      ctx.roundRect(0, 0, node.width, node.height, node.cornerRadius);
      ctx.fillStyle = node.fill;
      ctx.fill();
      if (node.strokeWidth > 0) {
        ctx.strokeStyle = node.stroke;
        ctx.lineWidth = node.strokeWidth;
        ctx.stroke();
      }
    } else if (node.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(node.width / 2, node.height / 2, node.width / 2, node.height / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = node.fill;
      ctx.fill();
      if (node.strokeWidth > 0) {
        ctx.strokeStyle = node.stroke;
        ctx.lineWidth = node.strokeWidth;
        ctx.stroke();
      }
    } else if (node.type === "text") {
      ctx.beginPath();
      ctx.rect(0, 0, node.width, node.height);
      ctx.clip();
      ctx.font = `${node.fontSize}px "Avenir Next", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
      ctx.textAlign = node.textAlign;
      ctx.textBaseline = "top";
      ctx.fillStyle = node.color;
      const x = node.textAlign === "center" ? node.width / 2 : node.textAlign === "right" ? node.width - 2 : 2;
      const lines = wrapText(node.content, node.width - 4, (text) => ctx.measureText(text).width);
      lines.forEach((line, index) => ctx.fillText(line, x, 2 + index * node.fontSize * 1.4));
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
