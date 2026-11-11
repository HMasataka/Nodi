import { DEFAULT_IMAGE_FILTERS, type ImageFilters } from "@/document/types.ts";

const ORDER = ["brightness", "contrast", "saturate", "grayscale", "sepia", "hueRotate"] as const;

export function hasImageFilters(filters: ImageFilters): boolean {
  return ORDER.some((key) => filters[key] !== DEFAULT_IMAGE_FILTERS[key]);
}

export function cssImageFilter(filters: ImageFilters): string {
  return ORDER.filter((key) => filters[key] !== DEFAULT_IMAGE_FILTERS[key]).map((key) =>
    key === "hueRotate" ? `hue-rotate(${filters[key]}deg)` : `${key}(${filters[key]})`).join(" ") || "none";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function matrix(rgb: number[], coefficients: number[], bias = 0): number[] {
  return [0, 1, 2].map((row) => clamp(rgb[0] * coefficients[row * 3] + rgb[1] * coefficients[row * 3 + 1] + rgb[2] * coefficients[row * 3 + 2] + bias));
}

function mix(identity: number[], target: number[], amount: number): number[] {
  return identity.map((value, index) => value * (1 - amount) + target[index] * amount);
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const GRAYSCALE = [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722];
const SEPIA = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];

export function filterPixels(input: Uint8ClampedArray, filters: ImageFilters): Uint8ClampedArray {
  if (!hasImageFilters(filters)) return new Uint8ClampedArray(input);
  const output = new Uint8ClampedArray(input.length);
  for (let index = 0; index < input.length; index += 4) {
    const alpha = input[index + 3];
    let rgb = [input[index], input[index + 1], input[index + 2]];
    if (alpha === 0) rgb = [0, 0, 0];
    else {
      if (filters.brightness !== 1) rgb = rgb.map((value) => clamp(value * filters.brightness));
      if (filters.contrast !== 1) rgb = rgb.map((value) => clamp((value - 127.5) * filters.contrast + 127.5));
      if (filters.saturate !== 1) {
        const s = filters.saturate;
        rgb = matrix(rgb, [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
          0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
          0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]);
      }
      if (filters.grayscale !== 0) rgb = matrix(rgb, mix(IDENTITY, GRAYSCALE, filters.grayscale));
      if (filters.sepia !== 0) rgb = matrix(rgb, mix(IDENTITY, SEPIA, filters.sepia));
      if (filters.hueRotate !== 0) {
        const angle = filters.hueRotate * Math.PI / 180;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        rgb = matrix(rgb, [0.213 + 0.787 * c - 0.213 * s, 0.715 - 0.715 * c - 0.715 * s, 0.072 - 0.072 * c + 0.928 * s,
          0.213 - 0.213 * c + 0.143 * s, 0.715 + 0.285 * c + 0.14 * s, 0.072 - 0.072 * c - 0.283 * s,
          0.213 - 0.213 * c - 0.787 * s, 0.715 - 0.715 * c + 0.715 * s, 0.072 + 0.928 * c + 0.072 * s]);
      }
    }
    output[index] = rgb[0];
    output[index + 1] = rgb[1];
    output[index + 2] = rgb[2];
    output[index + 3] = alpha;
  }
  return output;
}
