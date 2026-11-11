export function rgbColor(color: string): string {
  return color.slice(0, 7);
}

export function alphaByte(color: string): number {
  return color.length === 9 ? Number.parseInt(color.slice(7), 16) : 255;
}

export function withRgbColor(color: string, rgb: string): string {
  return rgb + (color.length === 9 ? color.slice(7) : "");
}

export function withAlphaByte(color: string, alpha: number): string {
  return alpha === 255 ? rgbColor(color) : `${rgbColor(color)}${alpha.toString(16).padStart(2, "0")}`;
}
