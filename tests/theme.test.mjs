import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("画面の色は :root のトークンだけを使い、未定義・未使用のトークンを残さない", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  const root = css.match(/:root \{([\s\S]*?)\n\}/);
  assert.ok(root, ":root のトークン定義がありません");
  const defined = new Set([...root[1].matchAll(/(--[a-z-]+):/g)].map(([, name]) => name));
  const used = new Set([...css.matchAll(/var\((--[a-z-]+)\)/g)].map(([, name]) => name));
  assert.deepEqual([...used].filter((name) => !defined.has(name)).sort(), []);
  assert.deepEqual([...defined].filter((name) => !used.has(name)).sort(), []);

  const rules = css.slice(root[0].length);
  assert.deepEqual(rules.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], "トークン以外の色指定が残っています");
  assert.equal(/(?<![-\w])white(?![-\w])/.test(rules), false, "色名の直接指定が残っています");
});
