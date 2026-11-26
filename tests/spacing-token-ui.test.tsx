import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { AssetsPanel } from "../src/pages/editor/components/organisms/AssetsPanel/AssetsPanel.tsx";
import { FrameLayoutEditor } from "../src/pages/editor/components/molecules/FrameLayoutEditor/FrameLayoutEditor.tsx";
import { parseDocument } from "../src/persistence/format.ts";
import { spacingTokenUsage } from "../src/document/spacing.ts";
import { document, frame, success } from "./support/factories.ts";

test("共通値の一覧は使用数を示し、参照中のフレームは名前と解決済みpx値を表示する", () => {
  const token = { id: "sp1", name: "カード余白", value: 24 };
  const first = frame({ id: "first", layoutMode: "vertical", paddingRef: token.id, gapRef: token.id });
  const second = frame({ id: "second", paddingRef: token.id });
  const design = { ...document(first, second), spacing: [token] };
  assert.equal(spacingTokenUsage(design, token.id), 3);
  const noop = () => {};
  const manage = renderToStaticMarkup(<AssetsPanel components={[]} onPlaceInstance={noop} onRenameComponent={noop} onDuplicateComponent={noop} onRemoveComponent={noop}
    palette={[]} onCreatePalette={noop} onImportPalette={noop} onRenamePalette={noop} onRecolorPalette={noop} onDuplicatePalette={noop} onDeletePalette={noop}
    spacing={[token]} spacingUsages={{ sp1: 3 }} onCreateSpacing={noop} onRenameSpacing={noop} onSetSpacing={noop} onRemoveSpacing={noop} />);
  assert.match(manage, />カード余白<\/button><span class="asset-row-value">24<\/span>/);
  const layout = renderToStaticMarkup(<FrameLayoutEditor node={first} tokens={[token]} onChange={() => {}} />);
  assert.match(layout, /カード余白 · 24px/);
  assert.match(layout, /共通値を編集すると反映/);
  assert.match(layout, /disabled=""[^>]*value="24"/);
  const direct = renderToStaticMarkup(<FrameLayoutEditor node={frame({ id: "direct", layoutMode: "horizontal", padding: 9 })} tokens={[token]} onChange={() => {}} />);
  assert.match(direct, /直接指定/);
  assert.match(direct, /value="9"/);
});

test("Studioのセクションは同じ共通余白値を参照する", () => {
  const sample = success(parseDocument(readFileSync(new URL("../samples/studio.nodi", import.meta.url), "utf8")));
  const token = sample.spacing.find(({ id }) => id === "sp_sample_section");
  assert.equal(token?.value, 80);
  assert.equal(spacingTokenUsage(sample, token!.id), 4);
});
