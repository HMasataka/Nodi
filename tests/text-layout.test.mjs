import assert from "node:assert/strict";
import test from "node:test";

import { wrapText } from "../src/document/textLayout.ts";

const measure = (text) => [...text].length * 8;

test("英単語を優先して折り返し、長い単語だけ文字境界で分割する", () => {
  assert.deepEqual(wrapText("Hello world", 48, measure), ["Hello", "world"]);
  assert.deepEqual(wrapText("ABCDEF", 16, measure), ["AB", "CD", "EF"]);
  assert.deepEqual(wrapText("one two three", 64, measure), ["one two", "three"]);
});

test("明示改行・空行・末尾改行と日本語混じりの文章を保つ", () => {
  assert.deepEqual(wrapText("Hi\r\n\r\nworld\n", 100, measure), ["Hi", "", "world", ""]);
  assert.deepEqual(wrapText("ABC日本語XYZ", 32, measure), ["ABC", "日本語", "XYZ"]);
  assert.deepEqual(wrapText("A  B", 24, measure), ["A", "B"]);
});

test("結合した絵文字を途中で切らず、枠より幅広い一文字も表示対象に残す", () => {
  assert.deepEqual(wrapText("👩‍💻👩‍💻", 24, measure), ["👩‍💻", "👩‍💻"]);
  assert.deepEqual(wrapText("大", 2, measure), ["大"]);
});
