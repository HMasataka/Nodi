import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

test("画面の色は :root のトークンだけを使い、未定義・未使用のトークンを残さない", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  const root = css.match(/:root \{([\s\S]*?)\n\}/);
  assert.ok(root, ":root のトークン定義がありません");
  const defined = new Set([...root[1].matchAll(/(--[a-z0-9-]+):/g)].map(([, name]) => name));
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(([, name]) => name));
  assert.deepEqual([...used].filter((name) => !defined.has(name)).sort(), []);
  // パレットの段は一揃いで定義するため、未使用の段を許す。用途名のトークンは使われていなければならない。
  const isStep = (name: string) => /^--(white|grey-\d{3}|purple-\d{3}|red-\d{3})$/.test(name);
  assert.deepEqual([...defined].filter((name) => !isStep(name) && !used.has(name)).sort(), []);

  // 色のリテラルはパレットの段にだけ書き、用途名のトークンは段を参照する。
  for (const [, name, value] of root[1].matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    if (isStep(name)) assert.match(value, /^#[0-9a-f]{6}$/, name);
    else assert.doesNotMatch(value, /#[0-9a-fA-F]{3,8}\b/, `${name} が段を参照していません`);
  }

  const rules = css.slice(root[0].length);
  assert.deepEqual(rules.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], "トークン以外の色指定が残っています");
  assert.equal(/(?<![-\w])white(?![-\w])/.test(rules), false, "色名の直接指定が残っています");
  const stepsInRules = [...rules.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(([, name]) => name).filter(isStep);
  assert.deepEqual(stepsInRules, [], "ルールがパレットの段を直接参照しています");
});
