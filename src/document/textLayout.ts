const words = new Intl.Segmenter(undefined, { granularity: "word" });
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function graphemeSegments(text: string): string[] {
  return Array.from(graphemes.segment(text), ({ segment }) => segment);
}

export function wrapText(content: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  const availableWidth = Math.max(0, width);
  for (const paragraph of content.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    function finishLine() {
      // 折り返しで行末になった空白は描かず、明示改行の空行は別に残す。
      lines.push(line.replace(/[ \t]+$/u, ""));
      line = "";
    }
    for (const { segment: word } of words.segment(paragraph)) {
      if (measure(line + word) <= availableWidth) { line += word; continue; }
      if (line.trimEnd()) finishLine();
      else line = "";
      if (/^[ \t]+$/u.test(word)) continue;
      if (measure(word) <= availableWidth) { line = word; continue; }
      for (const character of graphemeSegments(word)) {
        if (line && measure(line + character) > availableWidth) finishLine();
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}
