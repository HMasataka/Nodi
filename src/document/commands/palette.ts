import { Result } from "@praha/byethrow";

import { detachPaletteReferences } from "@/document/colorRef.ts";
import { validateName } from "@/document/commands/validation.ts";
import { type Document, HEX_COLOR_PATTERN, type PaletteColor } from "@/document/types.ts";

function validColor(color: string): boolean {
  return typeof color === "string" && HEX_COLOR_PATTERN.test(color);
}

function uniqueId(existing: Set<string>): string {
  let id = `pc_${crypto.randomUUID()}`;
  while (existing.has(id)) id = `pc_${crypto.randomUUID()}`;
  return id;
}

export function addPaletteColor(
  document: Document,
  input: { name: string; color: string },
): Result.Result<{ document: Document; color: PaletteColor }, Error> {
  const name = validateName(input.name);
  if (Result.isFailure(name)) return name;
  if (!validColor(input.color)) return Result.fail(new Error("色は #RRGGBB または #RRGGBBAA 形式で指定してください"));
  const color: PaletteColor = { id: uniqueId(new Set(document.palette.map((item) => item.id))), name: input.name, color: input.color };
  return Result.succeed({ document: { ...document, palette: [...document.palette, color] }, color });
}

export function renamePaletteColor(document: Document, id: string, name: string): Result.Result<Document, Error> {
  const validated = validateName(name);
  if (Result.isFailure(validated)) return validated;
  const target = document.palette.find((item) => item.id === id);
  if (!target) return Result.fail(new Error(`パレットの色が見つかりません: ${id}`));
  if (target.name === name) return Result.succeed(document);
  return Result.succeed({ ...document, palette: document.palette.map((item) => item.id === id ? { ...item, name } : item) });
}

export function setPaletteColor(document: Document, id: string, color: string): Result.Result<Document, Error> {
  if (!validColor(color)) return Result.fail(new Error("色は #RRGGBB または #RRGGBBAA 形式で指定してください"));
  const target = document.palette.find((item) => item.id === id);
  if (!target) return Result.fail(new Error(`パレットの色が見つかりません: ${id}`));
  if (target.color === color) return Result.succeed(document);
  return Result.succeed({ ...document, palette: document.palette.map((item) => item.id === id ? { ...item, color } : item) });
}

export function removePaletteColor(document: Document, id: string): Result.Result<Document, Error> {
  if (!document.palette.some((item) => item.id === id)) return Result.fail(new Error(`パレットの色が見つかりません: ${id}`));
  const detached = detachPaletteReferences(document, id);
  return Result.succeed({ ...detached, palette: detached.palette.filter((item) => item.id !== id) });
}

export function detachPaletteColor(document: Document, id: string): Result.Result<Document, Error> {
  if (!document.palette.some((item) => item.id === id)) return Result.fail(new Error(`パレットの色が見つかりません: ${id}`));
  return Result.succeed(detachPaletteReferences(document, id));
}

export function duplicatePaletteColor(document: Document, id: string): Result.Result<{ document: Document; color: PaletteColor }, Error> {
  const source = document.palette.find((item) => item.id === id);
  if (!source) return Result.fail(new Error(`パレットの色が見つかりません: ${id}`));
  const names = new Set(document.palette.map((item) => item.name));
  let name = `${source.name} のコピー`;
  let number = 2;
  while (names.has(name)) name = `${source.name} のコピー ${number++}`;
  const color: PaletteColor = { id: uniqueId(new Set(document.palette.map((item) => item.id))), name, color: source.color, ...(source.themes ? { themes: { ...source.themes } } : {}) };
  return Result.succeed({ document: { ...document, palette: [...document.palette, color] }, color });
}

/** 別文書のパレットを取り込む。すべての色へ新しい ID を割り当て、同名の色はそのまま許可する。 */
export function importPalette(document: Document, entries: { name: string; color: string }[]): Result.Result<{ document: Document; colors: PaletteColor[] }, Error> {
  for (const entry of entries) {
    if (Result.isFailure(validateName(entry.name))) return Result.fail(new Error("名前は空にできません"));
    if (!validColor(entry.color)) return Result.fail(new Error("色は #RRGGBB または #RRGGBBAA 形式で指定してください"));
  }
  const ids = new Set(document.palette.map((item) => item.id));
  const colors: PaletteColor[] = entries.map((entry) => {
    const id = uniqueId(ids);
    ids.add(id);
    return { id, name: entry.name, color: entry.color };
  });
  return Result.succeed({ document: { ...document, palette: [...document.palette, ...colors] }, colors });
}
