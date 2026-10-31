import { Result } from "@praha/byethrow";
import { MAX_IMAGE_SOURCE_LENGTH } from "@/document/types.ts";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const maxBytes = 5_000_000;

export function validateImageFile(file: { type: string; size: number }): Result.Result<void, Error> {
  if (!allowedTypes.has(file.type)) return Result.fail(new Error("PNG、JPEG、WEBP、SVG の画像を選んでください"));
  if (file.size === 0 || file.size > maxBytes) return Result.fail(new Error("画像は 5 MB 以下にしてください"));
  return Result.succeed();
}

export async function readImageFile(file: File): Promise<Result.Result<string, Error>> {
  const validated = validateImageFile(file);
  if (Result.isFailure(validated)) return validated;
  const loaded = await Result.fn({
    try: () => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("画像を読み取れません"));
      reader.onerror = () => reject(reader.error ?? new Error("画像を読み取れません"));
      reader.readAsDataURL(file);
    }),
    catch: (error) => new Error(`画像を読み取れません: ${String(error)}`),
  })();
  if (Result.isFailure(loaded)) return loaded;
  if (loaded.value.length > MAX_IMAGE_SOURCE_LENGTH) return Result.fail(new Error("画像データが大きすぎます"));
  const decoded = await Result.fn({
    try: () => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("画像を表示できません"));
      image.src = loaded.value;
    }),
    catch: (error) => new Error(`画像を表示できません: ${String(error)}`),
  })();
  if (Result.isFailure(decoded)) return decoded;
  return loaded;
}
