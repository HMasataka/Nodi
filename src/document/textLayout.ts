const words = new Intl.Segmenter(undefined, { granularity: "word" });
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function graphemeSegments(text: string): string[] {
  return Array.from(graphemes.segment(text), ({ segment }) => segment);
}

export function graphemeBoundaries(text: string): Set<number> {
  return new Set([...Array.from(graphemes.segment(text), ({ index }) => index), text.length]);
}

export interface TextUnit { text: string; start: number; end: number }

export function wrapTextUnits(content: string, width: number, measure: (units: TextUnit[]) => number): TextUnit[][] {
  const lines: TextUnit[][] = [];
  const availableWidth = Math.max(0, width);
  function layoutParagraph(paragraph: string, offset: number) {
    let line: TextUnit[] = [];
    function finishLine() {
      // 折り返しで行末になった空白は描かず、明示改行の空行は別に残す。
      while (line.length && /^[ \t]$/u.test(line[line.length - 1].text)) line.pop();
      lines.push(line);
      line = [];
    }
    for (const { segment: word, index } of words.segment(paragraph)) {
      const units = Array.from(graphemes.segment(word), ({ segment, index: position }) => ({
        text: segment, start: offset + index + position, end: offset + index + position + segment.length,
      }));
      if (measure([...line, ...units]) <= availableWidth) { line.push(...units); continue; }
      if (line.some((unit) => !/^[ \t]$/u.test(unit.text))) finishLine();
      else line = [];
      if (/^[ \t]+$/u.test(word)) continue;
      if (measure(units) <= availableWidth) { line = units; continue; }
      for (const unit of units) {
        if (line.length && measure([...line, unit]) > availableWidth) finishLine();
        line.push(unit);
      }
    }
    lines.push(line);
  }
  let offset = 0;
  for (const match of content.matchAll(/\r\n?|\n/g)) {
    layoutParagraph(content.slice(offset, match.index), offset);
    offset = match.index + match[0].length;
  }
  layoutParagraph(content.slice(offset), offset);
  return lines;
}

export function wrapText(content: string, width: number, measure: (text: string) => number): string[] {
  return wrapTextUnits(content, width, (units) => measure(units.map(({ text }) => text).join("")))
    .map((units) => units.map(({ text }) => text).join(""));
}
