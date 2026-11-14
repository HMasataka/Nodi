import { Result } from "@praha/byethrow";

import { vectorPathIssue } from "@/document/vectorPath.ts";
import { HEX_COLOR_PATTERN, type PathFillRule, type ShapeStyle, type VectorPathCommand } from "@/document/types.ts";

export interface SvgIconPath { commands: VectorPathCommand[]; fillRule: PathFillRule; style: ShapeStyle }
export interface SvgIcon { width: number; height: number; paths: SvgIconPath[] }

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_SVG_TEXT = 1_000_000;
const numberPattern = /[+-]?(?:\d+\.\d+|\d+|\.\d+)(?:[eE][+-]?\d+)?/y;
const supported = new Set("MmLlHhVvCcSsQqTtZz");
const fail = (message: string) => Result.fail(new Error(message));

function parsePathData(data: string, box: { x: number; y: number; width: number; height: number }): Result.Result<VectorPathCommand[], Error> {
  const tokens: (string | number)[] = [];
  let offset = 0;
  while (offset < data.length) {
    if (/[\s,]/.test(data[offset])) { offset++; continue; }
    if (/[a-zA-Z]/.test(data[offset])) {
      if (!supported.has(data[offset])) return fail(`未対応のSVGパス命令です: ${data[offset]}`);
      tokens.push(data[offset++]);
      continue;
    }
    numberPattern.lastIndex = offset;
    const match = numberPattern.exec(data);
    if (!match) return fail(`SVGパスの座標が不正です: ${data.slice(offset, offset + 12)}`);
    const value = Number(match[0]);
    if (!Number.isFinite(value)) return fail("SVGパスの座標は有限値で指定してください");
    tokens.push(value);
    offset = numberPattern.lastIndex;
    if (tokens.length > 15_000) return fail("SVGパスの命令が多すぎます");
  }
  const result: VectorPathCommand[] = [];
  let index = 0;
  let active = "";
  let current = { x: 0, y: 0 };
  let start = current;
  let cubicControl: { x: number; y: number } | null = null;
  let quadraticControl: { x: number; y: number } | null = null;
  let previousKind = "";
  const take = (count: number): number[] | null => {
    const values = tokens.slice(index, index + count);
    if (values.length !== count || values.some((value) => typeof value !== "number")) return null;
    index += count;
    return values as number[];
  };
  const resolve = (x: number, y: number, relative: boolean) => ({ x: x + (relative ? current.x : 0), y: y + (relative ? current.y : 0) });
  const normalized = (point: { x: number; y: number }) => ({ x: (point.x - box.x) / box.width, y: (point.y - box.y) / box.height });
  while (index < tokens.length) {
    if (typeof tokens[index] === "string") active = tokens[index++] as string;
    if (!active) return fail("SVGパスはM命令から始めてください");
    const kind = active.toUpperCase();
    const relative = active !== kind;
    if (kind === "Z") {
      result.push({ kind: "close" });
      current = start;
      previousKind = "Z";
      cubicControl = quadraticControl = null;
      active = "";
      continue;
    }
    if (typeof tokens[index] !== "number") return fail(`SVGパスの${kind}命令に座標がありません`);
    if (kind === "M" || kind === "L") {
      const values = take(2);
      if (!values) return fail("SVGパスの座標が不足しています");
      current = resolve(values[0], values[1], relative);
      if (kind === "M") { start = current; result.push({ kind: "move", ...normalized(current) }); active = relative ? "l" : "L"; }
      else result.push({ kind: "line", ...normalized(current) });
      previousKind = kind;
    } else if (kind === "H" || kind === "V") {
      const values = take(1);
      if (!values) return fail("SVGパスの座標が不足しています");
      current = kind === "H" ? { x: values[0] + (relative ? current.x : 0), y: current.y }
        : { x: current.x, y: values[0] + (relative ? current.y : 0) };
      result.push({ kind: "line", ...normalized(current) });
      previousKind = kind;
    } else if (kind === "C" || kind === "S") {
      const values = take(kind === "C" ? 6 : 4);
      if (!values) return fail("SVGパスの曲線座標が不足しています");
      const reflected = (kind === "S" && (previousKind === "C" || previousKind === "S") && cubicControl)
        ? { x: current.x * 2 - cubicControl.x, y: current.y * 2 - cubicControl.y } : current;
      const first = kind === "C" ? resolve(values[0], values[1], relative) : reflected;
      const second = resolve(values[kind === "C" ? 2 : 0], values[kind === "C" ? 3 : 1], relative);
      const end = resolve(values[kind === "C" ? 4 : 2], values[kind === "C" ? 5 : 3], relative);
      result.push({ kind: "cubic", x1: normalized(first).x, y1: normalized(first).y,
        x2: normalized(second).x, y2: normalized(second).y, ...normalized(end) });
      current = end;
      cubicControl = second;
      previousKind = kind;
    } else if (kind === "Q" || kind === "T") {
      const values = take(kind === "Q" ? 4 : 2);
      if (!values) return fail("SVGパスの曲線座標が不足しています");
      const control: { x: number; y: number } = (kind === "T" && (previousKind === "Q" || previousKind === "T") && quadraticControl)
        ? { x: current.x * 2 - quadraticControl.x, y: current.y * 2 - quadraticControl.y }
        : kind === "Q" ? resolve(values[0], values[1], relative) : current;
      const end = resolve(values[kind === "Q" ? 2 : 0], values[kind === "Q" ? 3 : 1], relative);
      const first = { x: current.x + (control.x - current.x) * 2 / 3, y: current.y + (control.y - current.y) * 2 / 3 };
      const second = { x: end.x + (control.x - end.x) * 2 / 3, y: end.y + (control.y - end.y) * 2 / 3 };
      result.push({ kind: "cubic", x1: normalized(first).x, y1: normalized(first).y,
        x2: normalized(second).x, y2: normalized(second).y, ...normalized(end) });
      current = end;
      quadraticControl = control;
      previousKind = kind;
    }
    if (kind !== "C" && kind !== "S") cubicControl = null;
    if (kind !== "Q" && kind !== "T") quadraticControl = null;
    if (result.length > 2048) return fail("SVGパスの命令が多すぎます");
  }
  const issue = vectorPathIssue(result, "nonzero");
  return issue ? fail(issue) : Result.succeed(result);
}

function checkAttributes(element: Element, allowed: Set<string>): Result.Result<void, Error> {
  for (const attribute of Array.from(element.attributes)) if (!allowed.has(attribute.name)) return fail(`未対応のSVG属性です: ${attribute.name}`);
  return Result.succeed();
}

function parseColor(value: string | null, fallback: string | null, currentColor: string): Result.Result<string | null, Error> {
  if (value === null) return Result.succeed(fallback);
  if (value === "none") return Result.succeed(null);
  if (value === "currentColor") return Result.succeed(currentColor);
  if (HEX_COLOR_PATTERN.test(value)) return Result.succeed(value);
  const short = /^#([0-9a-fA-F]{3,4})$/.exec(value);
  return short ? Result.succeed(`#${[...short[1]].map((part) => part + part).join("")}`) : fail(`未対応のSVG色です: ${value}`);
}

function parseSvgIcon(svg: string, parseXml: (source: string) => XMLDocument): Result.Result<SvgIcon, Error> {
  if (svg.length === 0 || svg.length > MAX_SVG_TEXT) return fail("SVGは1MB以下にしてください");
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(svg)) return fail("外部定義を含むSVGは取り込めません");
  const parsed = Result.fn({ try: () => parseXml(svg), catch: () => new Error("SVGのXML構文が不正です") })();
  if (Result.isFailure(parsed)) return parsed;
  const xml = parsed.value;
  if (xml.getElementsByTagName("parsererror").length > 0) return fail("SVGのXML構文が不正です");
  const root = xml.documentElement;
  if (!root || root.localName !== "svg" || root.namespaceURI !== SVG_NS) return fail("SVGのルート要素が不正です");
  const rootAttributes = checkAttributes(root, new Set(["xmlns", "viewBox", "width", "height", "version", "id", "fill", "stroke", "stroke-width", "fill-rule", "color"]));
  if (Result.isFailure(rootAttributes)) return rootAttributes;
  const values = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (!values || values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) return fail("正しいviewBoxが必要です");
  const box = { x: values[0], y: values[1], width: values[2], height: values[3] };
  const rootColor = parseColor(root.getAttribute("color"), "#000000", "#000000");
  if (Result.isFailure(rootColor)) return rootColor;
  const currentColor = rootColor.value ?? "#000000";
  const rootFill = parseColor(root.getAttribute("fill"), "#000000", currentColor);
  if (Result.isFailure(rootFill)) return rootFill;
  const rootStroke = parseColor(root.getAttribute("stroke"), null, currentColor);
  if (Result.isFailure(rootStroke)) return rootStroke;
  const paths: SvgIconPath[] = [];
  for (const child of Array.from(root.childNodes)) {
    if ((child.nodeType === 3 && child.textContent?.trim() === "") || child.nodeType === 8) continue;
    if (child.nodeType !== 1 || (child as Element).localName !== "path" || (child as Element).namespaceURI !== SVG_NS) {
      return fail(`未対応のSVG要素です: ${child.nodeName}`);
    }
    const element = child as Element;
    const checked = checkAttributes(element, new Set(["d", "id", "fill", "stroke", "stroke-width", "fill-rule", "clip-rule"]));
    if (Result.isFailure(checked)) return checked;
    const clipRule = element.getAttribute("clip-rule");
    if (clipRule !== null && clipRule !== "nonzero" && clipRule !== "evenodd") return fail(`未対応のクリップ規則です: ${clipRule}`);
    const rule = element.getAttribute("fill-rule") ?? root.getAttribute("fill-rule") ?? "nonzero";
    if (rule !== "nonzero" && rule !== "evenodd") return fail(`未対応の塗り規則です: ${rule}`);
    const stroke = parseColor(element.getAttribute("stroke"), rootStroke.value, currentColor);
    if (Result.isFailure(stroke)) return stroke;
    const width = Number(element.getAttribute("stroke-width") ?? root.getAttribute("stroke-width") ?? "1");
    if (!Number.isFinite(width) || width < 0) return fail("線幅が不正です");
    const fill = parseColor(element.getAttribute("fill"), rootFill.value, currentColor);
    if (Result.isFailure(fill)) return fill;
    const commands = parsePathData(element.getAttribute("d") ?? "", box);
    if (Result.isFailure(commands)) return commands;
    paths.push({ commands: commands.value, fillRule: rule, style: { fill: fill.value,
      stroke: stroke.value === null ? null : { color: stroke.value, width } } });
    if (paths.length > 128) return fail("SVGのパスは128個までです");
  }
  return paths.length ? Result.succeed({ width: box.width, height: box.height, paths }) : fail("SVGにパスがありません");
}

export function importSvgPaths(svg: string, parseXml: (source: string) => XMLDocument = (source) => new DOMParser().parseFromString(source, "image/svg+xml")) {
  return parseSvgIcon(svg, parseXml);
}
