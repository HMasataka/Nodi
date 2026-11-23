import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

test("左パネルの上部でレイヤーとアセットを切り換え、コンポーネントと色はアセットのタブに置く", async () => {
  const page = await readFile(new URL("../src/pages/editor/index.tsx", import.meta.url), "utf8");
  const left = page.slice(page.indexOf('<div className="left-panels">'), page.indexOf('<div className="editor-center">'));
  assert.match(left, /<div className="left-panel-tabs">\s*<Segmented<LeftPanelTab> label="左パネル" value=\{leftTab\} onChange=\{setLeftTab\} options=\{LEFT_PANEL_TABS\} \/>/);
  assert.match(left, /\{leftTab === "layers"\s*\? <LayersPanel [^]*: <AssetsPanel [^]*palette=\{design\.palette\}/);
  assert.match(page, /\{ value: "layers", label: "レイヤー" \}, \{ value: "assets", label: "アセット" \}/);
  assert.match(page, /useState<LeftPanelTab>\("layers"\)/);
});
