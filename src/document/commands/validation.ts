import { Result } from "@praha/byethrow";
import type { Geometry } from "@/document/types.ts";

export function validateName(name: string): Result.Result<string, Error> {
  if (!name.trim()) return Result.fail(new Error("名前は空にできません"));
  return Result.succeed(name);
}

export function validateGeometry(geometry: Geometry): Result.Result<void, Error> {
  if (![geometry.x, geometry.y].every(Number.isFinite)) {
    return Result.fail(new Error("座標は有限の数値で指定してください"));
  }
  if (![geometry.width, geometry.height].every((value) => Number.isFinite(value) && value > 0)) {
    return Result.fail(new Error("幅と高さは正の有限の数値で指定してください"));
  }
  return Result.succeed();
}
