import { DEFAULT_TEXT_FONT_FAMILY, DEFAULT_TEXT_FONT_WEIGHT, type TextFontFamily, type TextStyle } from "@/document/types.ts";

const FONT_STACKS: Record<TextFontFamily, string> = {
  default: '"Avenir Next", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  monospace: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
};

export function resolvedTextFont(style: Pick<TextStyle, "fontFamily" | "fontWeight">) {
  return {
    fontFamily: FONT_STACKS[style.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY],
    fontWeight: style.fontWeight ?? DEFAULT_TEXT_FONT_WEIGHT,
  };
}
