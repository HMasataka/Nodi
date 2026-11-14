import { Result } from "@praha/byethrow";

import type { VectorPathCommand } from "@/document/types.ts";
import { MAX_PATH_COMMANDS, vectorPathIssue } from "@/document/vectorPath.ts";

export interface SvgViewBox { x: number; y: number; width: number; height: number }
interface Point { x: number; y: number }
type PreviousControl = { kind: "cubic" | "quadratic"; point: Point } | null;
type PathToken = string | number;

const SUPPORTED_COMMANDS = new Set("MmLlHhVvCcSsQqTtZz");
const MAX_PATH_TOKENS = 15_000;
const fail = (message: string) => Result.fail(new Error(message));

function tokenizePathData(data: string): Result.Result<PathToken[], Error> {
  // lastIndexは一回の解析内だけで使用する。
  const numberPattern = /[+-]?(?:\d+\.\d+|\d+|\.\d+)(?:[eE][+-]?\d+)?/y;
  const tokens: PathToken[] = [];
  let offset = 0;
  while (offset < data.length) {
    if (/[\s,]/.test(data[offset])) { offset++; continue; }
    if (/[a-zA-Z]/.test(data[offset])) {
      if (!SUPPORTED_COMMANDS.has(data[offset])) return fail(`未対応のSVGパス命令です: ${data[offset]}`);
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
    if (tokens.length > MAX_PATH_TOKENS) return fail("SVGパスの命令が多すぎます");
  }
  return Result.succeed(tokens);
}

function reflectedControl(previous: PreviousControl, kind: "cubic" | "quadratic", current: Point): Point {
  if (previous?.kind !== kind) return current;
  return { x: current.x * 2 - previous.point.x, y: current.y * 2 - previous.point.y };
}

/** 対応済みのSVG命令を、viewBox基準の直線・3次ベジェへ変換する。失敗時は部分結果を返さない。 */
export function parseSvgPathData(data: string, box: SvgViewBox): Result.Result<VectorPathCommand[], Error> {
  const tokenized = tokenizePathData(data);
  if (Result.isFailure(tokenized)) return tokenized;
  const tokens = tokenized.value;
  const commands: VectorPathCommand[] = [];
  let index = 0;
  let activeCommand = "";
  let current: Point = { x: 0, y: 0 };
  let subpathStart = current;
  let previousControl: PreviousControl = null;

  // 引数が不足した場合はカーソルを進めない。呼び出し側が命令ごとのエラーを返す。
  const take = (count: number): number[] | null => {
    const values = tokens.slice(index, index + count);
    if (values.length !== count || values.some((value) => typeof value !== "number")) return null;
    index += count;
    return values as number[];
  };
  const normalize = (point: Point): Point => ({ x: (point.x - box.x) / box.width, y: (point.y - box.y) / box.height });
  const appendCubic = (first: Point, second: Point, end: Point) => {
    const control1 = normalize(first);
    const control2 = normalize(second);
    commands.push({ kind: "cubic", x1: control1.x, y1: control1.y, x2: control2.x, y2: control2.y, ...normalize(end) });
  };

  while (index < tokens.length) {
    if (typeof tokens[index] === "string") activeCommand = tokens[index++] as string;
    if (!activeCommand) return fail("SVGパスはM命令から始めてください");
    const kind = activeCommand.toUpperCase();
    const relative = activeCommand !== kind;
    // 同じ命令内の全制御点と終点は、命令開始時のcurrentを基準にする。
    const resolve = (x: number, y: number): Point => ({ x: x + (relative ? current.x : 0), y: y + (relative ? current.y : 0) });
    if (kind === "Z") {
      commands.push({ kind: "close" });
      current = subpathStart;
      previousControl = null;
      activeCommand = "";
      continue;
    }
    if (typeof tokens[index] !== "number") return fail(`SVGパスの${kind}命令に座標がありません`);
    let end: Point;
    let nextControl: PreviousControl = null;
    switch (kind) {
      case "M":
      case "L": {
        const values = take(2);
        if (!values) return fail("SVGパスの座標が不足しています");
        const [x, y] = values;
        end = resolve(x, y);
        commands.push({ kind: kind === "M" ? "move" : "line", ...normalize(end) });
        if (kind === "M") {
          subpathStart = end;
          // movetoに続く座標の省略記法はlinetoになる。
          activeCommand = relative ? "l" : "L";
        }
        break;
      }
      case "H":
      case "V": {
        const values = take(1);
        if (!values) return fail("SVGパスの座標が不足しています");
        const [value] = values;
        end = kind === "H" ? { x: value + (relative ? current.x : 0), y: current.y }
          : { x: current.x, y: value + (relative ? current.y : 0) };
        commands.push({ kind: "line", ...normalize(end) });
        break;
      }
      case "C": {
        const values = take(6);
        if (!values) return fail("SVGパスの曲線座標が不足しています");
        const [x1, y1, x2, y2, x, y] = values;
        const second = resolve(x2, y2);
        end = resolve(x, y);
        appendCubic(resolve(x1, y1), second, end);
        nextControl = { kind: "cubic", point: second };
        break;
      }
      case "S": {
        const values = take(4);
        if (!values) return fail("SVGパスの曲線座標が不足しています");
        const [x2, y2, x, y] = values;
        const second = resolve(x2, y2);
        end = resolve(x, y);
        appendCubic(reflectedControl(previousControl, "cubic", current), second, end);
        nextControl = { kind: "cubic", point: second };
        break;
      }
      case "Q":
      case "T": {
        const values = take(kind === "Q" ? 4 : 2);
        if (!values) return fail("SVGパスの曲線座標が不足しています");
        let control: Point;
        if (kind === "Q") {
          const [cx, cy, x, y] = values;
          control = resolve(cx, cy);
          end = resolve(x, y);
        } else {
          const [x, y] = values;
          control = reflectedControl(previousControl, "quadratic", current);
          end = resolve(x, y);
        }
        // 2次ベジェの制御点へ両端から2/3進むと、同じ曲線の3次制御点になる。
        const first = { x: current.x + (control.x - current.x) * 2 / 3, y: current.y + (control.y - current.y) * 2 / 3 };
        const second = { x: end.x + (control.x - end.x) * 2 / 3, y: end.y + (control.y - end.y) * 2 / 3 };
        appendCubic(first, second, end);
        nextControl = { kind: "quadratic", point: control };
        break;
      }
      default: return fail(`未対応のSVGパス命令です: ${activeCommand}`);
    }
    current = end;
    // 曲線以外の命令はnullへ戻す。別種の曲線の制御点を引き継がない。
    previousControl = nextControl;
    if (commands.length > MAX_PATH_COMMANDS) return fail("SVGパスの命令が多すぎます");
  }
  const issue = vectorPathIssue(commands, "nonzero");
  return issue ? fail(issue) : Result.succeed(commands);
}
