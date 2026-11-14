import { Result } from "@praha/byethrow";

import { parseSvgPathData } from "@/document/svgPathData.ts";
import { HEX_COLOR_PATTERN, type PathFillRule, type ShapeStyle, type VectorPathCommand } from "@/document/types.ts";

export interface SvgIconPath { commands: VectorPathCommand[]; fillRule: PathFillRule; style: ShapeStyle }
export interface SvgIcon { width: number; height: number; paths: SvgIconPath[] }

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_SVG_TEXT = 1_000_000;
const fail = (message: string) => Result.fail(new Error(message));

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
    const commands = parseSvgPathData(element.getAttribute("d") ?? "", box);
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
