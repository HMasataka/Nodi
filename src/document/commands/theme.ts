import { Result } from "@praha/byethrow";

import { mapChildGroups } from "@/document/childGroups.ts";
import { collectNodes, findNode, updateNode } from "@/document/commands/tree.ts";
import { type Document, type DocumentNode, HEX_COLOR_PATTERN, type PaletteColor } from "@/document/types.ts";

function frameThemes(document: Document): Set<string> {
  const nodes = [...collectNodes(document.children), ...collectNodes(document.components.map((component) => component.node))];
  return new Set(nodes.flatMap((node) => node.type === "frame" && node.theme !== undefined ? [node.theme] : []));
}

// パレット色のテーマごとの値から、最初以外のテーマにないキーを外す。空になったら項目ごと省く。
function keepThemeValues(color: PaletteColor, others: Set<string>): PaletteColor {
  if (!color.themes) return color;
  const entries = Object.entries(color.themes).filter(([theme]) => others.has(theme));
  if (entries.length === Object.keys(color.themes).length) return color;
  const { themes: _removed, ...rest } = color;
  return entries.length === 0 ? rest : { ...rest, themes: Object.fromEntries(entries) };
}

function withThemes(document: Document, themes: string[]): Document {
  const { themes: _removed, ...rest } = document;
  return themes.length === 0 ? rest : { ...rest, themes };
}

/**
 * テーマ名の一覧を置き換える。最初のテーマが既定になる。
 * 一覧から外したテーマと新しい最初のテーマの、パレット色の値は外す。フレームが使っているテーマは外せない。
 */
export function setThemes(document: Document, themes: string[]): Result.Result<Document, Error> {
  if (!Array.isArray(themes) || themes.some((theme) => typeof theme !== "string" || theme.trim() === "")) {
    return Result.fail(new Error("テーマ名は空にできません"));
  }
  if (new Set(themes).size !== themes.length) return Result.fail(new Error("テーマ名が重複しています"));
  const used = [...frameThemes(document)].filter((theme) => !themes.includes(theme));
  if (used.length > 0) return Result.fail(new Error(`フレームが使っているテーマは外せません: ${used.join(", ")}`));
  const others = new Set(themes.slice(1));
  return Result.succeed({ ...withThemes(document, themes), palette: document.palette.map((color) => keepThemeValues(color, others)) });
}

/** テーマの名前を変え、パレット色の値とフレームのテーマ指定も新しい名前に付け替える。 */
export function renameTheme(document: Document, from: string, to: string): Result.Result<Document, Error> {
  const themes = document.themes ?? [];
  if (!themes.includes(from)) return Result.fail(new Error(`テーマが見つかりません: ${from}`));
  if (typeof to !== "string" || to.trim() === "") return Result.fail(new Error("テーマ名は空にできません"));
  if (from === to) return Result.succeed(document);
  if (themes.includes(to)) return Result.fail(new Error(`テーマ名が重複しています: ${to}`));
  const rename = (node: DocumentNode): DocumentNode => mapChildGroups(node.type === "frame" && node.theme === from ? { ...node, theme: to } : node,
    (nodes) => nodes.map(rename));
  return Result.succeed({
    ...document,
    themes: themes.map((theme) => theme === from ? to : theme),
    palette: document.palette.map((color) => color.themes && from in color.themes
      ? { ...color, themes: Object.fromEntries(Object.entries(color.themes).map(([theme, value]) => [theme === from ? to : theme, value])) }
      : color),
    children: document.children.map(rename),
    components: document.components.map((component) => ({ ...component, node: rename(component.node) })),
  });
}

/**
 * パレット色の、最初以外のテーマの値を設定する。`null` で値を外し、`color`（最初のテーマの値）を使うようにする。
 * 最初のテーマの値は `setPaletteColor` で変える。
 */
export function setPaletteThemeColor(document: Document, id: string, theme: string, color: string | null): Result.Result<Document, Error> {
  const themes = document.themes ?? [];
  const target = document.palette.find((item) => item.id === id);
  if (!target) return Result.fail(new Error(`パレットの色が見つかりません: ${id}`));
  if (!themes.includes(theme)) return Result.fail(new Error(`テーマが見つかりません: ${theme}`));
  if (themes[0] === theme) return Result.fail(new Error(`最初のテーマの値はパレットの色そのものを変えてください: ${theme}`));
  if (color !== null && (typeof color !== "string" || !HEX_COLOR_PATTERN.test(color))) {
    return Result.fail(new Error("色は #RRGGBB または #RRGGBBAA 形式で指定してください"));
  }
  if ((target.themes?.[theme] ?? null) === color) return Result.succeed(document);
  const values = { ...target.themes };
  if (color === null) delete values[theme];
  else values[theme] = color;
  const { themes: _removed, ...rest } = target;
  const updated: PaletteColor = Object.keys(values).length === 0 ? rest : { ...rest, themes: values };
  return Result.succeed({ ...document, palette: document.palette.map((item) => item.id === id ? updated : item) });
}

/** フレームのテーマを指定する。`null` で指定を外し、親のテーマ（最上位では最初のテーマ）に従わせる。 */
export function setFrameTheme(document: Document, id: string, theme: string | null): Result.Result<Document, Error> {
  const node = findNode(document, id);
  if (!node) return Result.fail(new Error(`要素が見つかりません: ${id}`));
  if (node.type !== "frame") return Result.fail(new Error("テーマはフレームにだけ指定できます"));
  if (theme !== null && !(document.themes ?? []).includes(theme)) return Result.fail(new Error(`テーマが見つかりません: ${theme}`));
  if ((node.theme ?? null) === theme) return Result.succeed(document);
  return updateNode(document, id, (current) => {
    if (current.type !== "frame") return current;
    const { theme: _removed, ...rest } = current;
    return theme === null ? rest : { ...rest, theme };
  });
}
