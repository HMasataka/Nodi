import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { FrameLayoutEditor } from "../src/pages/editor/components/molecules/FrameLayoutEditor/FrameLayoutEditor.tsx";
import { parseDocument } from "../src/persistence/format.ts";
import { SpacingTokenEditor } from "../src/pages/editor/components/molecules/SpacingTokenEditor/SpacingTokenEditor.tsx";
import { spacingTokenUsage } from "../src/document/spacing.ts";
import { document, frame, success } from "./support/factories.ts";

test("共通値の一覧は使用数を示し、参照中のフレームは名前と解決済みpx値を表示する", () => {
  const token = { id: "sp1", name: "カード余白", value: 24 };
  const first = frame({ id: "first", paddingRef: token.id, gapRef: token.id });
  const second = frame({ id: "second", paddingRef: token.id });
  const design = { ...document(first, second), spacing: [token] };
  assert.equal(spacingTokenUsage(design, token.id), 3);
  const manage = renderToStaticMarkup(<SpacingTokenEditor tokens={[token]} usages={{ sp1: 3 }} onCreate={() => {}}
    onRename={() => {}} onValue={() => {}} onRemove={() => {}} />);
  assert.match(manage, /3 箇所で使用/);
  assert.match(manage, /削除すると、参照先は現在のpx値で固定/);
  const layout = renderToStaticMarkup(<FrameLayoutEditor node={first} tokens={[token]} onChange={() => {}} />);
  assert.match(layout, /カード余白 · 24px/);
  assert.match(layout, /共通値を編集すると反映/);
  assert.match(layout, /disabled="" value="24"/);
  const direct = renderToStaticMarkup(<FrameLayoutEditor node={frame({ id: "direct", padding: 9 })} tokens={[token]} onChange={() => {}} />);
  assert.match(direct, /直接指定/);
  assert.match(direct, /value="9"/);
});

test("Studioの2フレームは同じ共通余白値を参照する", () => {
  const sample = success(parseDocument(readFileSync(new URL("../samples/studio.nodi", import.meta.url), "utf8")));
  const token = sample.spacing.find(({ id }) => id === "sp_sample_card");
  assert.equal(token?.value, 20);
  assert.equal(spacingTokenUsage(sample, token!.id), 4);
});
