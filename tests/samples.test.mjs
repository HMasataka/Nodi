import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { parseDocument, serializeDocument } from "../src/document/format.ts";

test("全サンプルを現行形式で開いて保存し直せる", async () => {
  const directory = new URL("../samples/", import.meta.url);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".nodi"));
  assert.ok(names.length > 0);

  for (const name of names) {
    const text = await readFile(new URL(name, directory), "utf8");
    const loaded = parseDocument(text);
    assert.equal(loaded.type, "Success", `${name} を読み込めません`);
    const saved = serializeDocument(loaded.value);
    assert.equal(saved.type, "Success", `${name} を保存できません`);
    assert.deepEqual(parseDocument(saved.value).value, loaded.value);
  }
});
