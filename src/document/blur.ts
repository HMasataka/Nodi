// 透明ピクセルを黒として扱い、乗算済みRGBでぼかすことで透明な縁の色にじみを防ぐ。
export function blurPixels(source: Uint8ClampedArray, width: number, height: number, sigma: number): Uint8ClampedArray {
  if (sigma === 0) return new Uint8ClampedArray(source);
  const radius = Math.ceil(sigma * 3);
  const weights = Array.from({ length: radius * 2 + 1 }, (_, index) => Math.exp(-((index - radius) ** 2) / (2 * sigma * sigma)));
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const horizontal = new Float64Array(source.length);
  const result = new Uint8ClampedArray(source.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const target = (y * width + x) * 4;
    for (let offset = -radius; offset <= radius; offset++) {
      const sampleX = x + offset;
      if (sampleX < 0 || sampleX >= width) continue;
      const index = (y * width + sampleX) * 4;
      const weight = weights[offset + radius] / sum;
      const alpha = source[index + 3] / 255;
      for (let channel = 0; channel < 3; channel++) horizontal[target + channel] += source[index + channel] * alpha * weight;
      horizontal[target + 3] += source[index + 3] * weight;
    }
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const target = (y * width + x) * 4;
    const accumulated = [0, 0, 0, 0];
    for (let offset = -radius; offset <= radius; offset++) {
      const sampleY = y + offset;
      if (sampleY < 0 || sampleY >= height) continue;
      const index = (sampleY * width + x) * 4;
      const weight = weights[offset + radius] / sum;
      for (let channel = 0; channel < 4; channel++) accumulated[channel] += horizontal[index + channel] * weight;
    }
    const alpha = accumulated[3];
    for (let channel = 0; channel < 3; channel++) result[target + channel] = alpha > 0 ? accumulated[channel] * 255 / alpha : 0;
    result[target + 3] = alpha;
  }
  return result;
}
