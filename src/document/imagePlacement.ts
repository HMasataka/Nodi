import type { ImageStyle } from "@/document/types.ts";

export function imageObjectPosition(style: ImageStyle): string {
  return `${style.focalPoint.x * 100}% ${style.focalPoint.y * 100}%`;
}

export function imagePlacement(sourceWidth: number, sourceHeight: number, width: number, height: number, style: ImageStyle) {
  if (style.fit === "fill") return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight, dx: 0, dy: 0, dw: width, dh: height };
  const scale = style.fit === "cover" ? Math.max(width / sourceWidth, height / sourceHeight) : Math.min(width / sourceWidth, height / sourceHeight);
  if (style.fit === "cover") {
    const sw = width / scale;
    const sh = height / scale;
    return { sx: (sourceWidth - sw) * style.focalPoint.x, sy: (sourceHeight - sh) * style.focalPoint.y,
      sw, sh, dx: 0, dy: 0, dw: width, dh: height };
  }
  const dw = sourceWidth * scale;
  const dh = sourceHeight * scale;
  return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight,
    dx: (width - dw) * style.focalPoint.x, dy: (height - dh) * style.focalPoint.y, dw, dh };
}
