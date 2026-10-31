import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../src/pages/editor/components/", import.meta.url));
const rank = { atoms: 0, molecules: 1, organisms: 2 };

test("ページ内コンポーネントは粒度別フォルダに置き、下位から上位を import しない", async () => {
  for (const layer of Object.keys(rank)) {
    const groups = await readdir(join(root, layer), { withFileTypes: true });
    for (const group of groups.filter((entry) => entry.isDirectory())) {
      const directory = join(root, layer, group.name);
      const files = await readdir(directory);
      assert.ok(files.includes(`${group.name}.tsx`), `${directory} に実装がありません`);
      assert.ok(files.includes("index.ts"), `${directory} に re-export がありません`);
      const source = await readFile(join(directory, `${group.name}.tsx`), "utf8");
      for (const [, specifier] of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
        const target = resolve(dirname(join(directory, `${group.name}.tsx`)), specifier);
        const match = target.match(/\/components\/(atoms|molecules|organisms)\//);
        if (match) assert.ok(rank[match[1]] <= rank[layer], `${group.name} は上位の ${match[1]} を import できません`);
      }
    }
  }
});
