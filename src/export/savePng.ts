import { Result } from "@praha/byethrow";

export interface PngFileAccess {
  pickSave(defaultPath: string): Promise<string | null>;
  write(path: string, bytes: Uint8Array): Promise<void>;
}

export async function savePng(access: PngFileAccess, blob: Blob, defaultPath: string): Promise<Result.Result<string | null, Error>> {
  if (blob.type !== "image/png") return Result.fail(new Error("PNG データが不正です"));
  const picked = await Result.fn({
    try: () => access.pickSave(defaultPath),
    catch: (error) => new Error(`保存先を選択できません: ${String(error)}`),
  })();
  if (Result.isFailure(picked)) return picked;
  if (picked.value === null) return Result.succeed(null);
  const path = picked.value;
  const data = await Result.fn({
    try: () => blob.arrayBuffer(),
    catch: (error) => new Error(`PNG を読み取れません: ${String(error)}`),
  })();
  if (Result.isFailure(data)) return data;
  const written = await Result.fn({
    try: () => access.write(path, new Uint8Array(data.value)),
    catch: (error) => new Error(`PNG を保存できません: ${String(error)}`),
  })();
  if (Result.isFailure(written)) return written;
  return Result.succeed(path);
}
