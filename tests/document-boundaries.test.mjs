import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { readdir, readFile } from "node:fs/promises";

const root = new URL("../src/document/", import.meta.url);
const rootPath = fileURLToPath(root);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    return entry.isDirectory() ? sourceFiles(url) : entry.name.endsWith(".ts") ? [url] : [];
  }));
  return nested.flat();
}

test("ドキュメントの中核は画面・入出力・MCP アダプターへ依存しない", async () => {
  for (const file of await sourceFiles(root)) {
    const source = await readFile(file, "utf8");
    for (const [, specifier] of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      if (specifier.startsWith("@/")) {
        assert.ok(specifier.startsWith("@/document/"), `${file.pathname} から ${specifier} を参照できません`);
      } else if (specifier.startsWith(".")) {
        assert.ok(resolve(dirname(fileURLToPath(file)), specifier).startsWith(rootPath), `${file.pathname} から ${specifier} を参照できません`);
      }
    }
  }
});
