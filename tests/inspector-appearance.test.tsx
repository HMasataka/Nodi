import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { Inspector } from "../src/pages/editor/components/organisms/Inspector/Inspector.tsx";

import { CornerRadiiEditor, uniformRadius } from "../src/pages/editor/components/molecules/CornerRadiiEditor/CornerRadiiEditor.tsx";
import type { DocumentNode, RectangleStyle } from "../src/document/types.ts";
import { ellipse, frame, rectangle } from "./support/factories.ts";
import { hasStroke, StrokeEditor } from "../src/pages/editor/components/molecules/StrokeEditor/StrokeEditor.tsx";

const noOp = () => {};
const square = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

function inspect(selected: DocumentNode, onShapeStyle: (style: Partial<RectangleStyle>) => void = noOp) {
  return renderToStaticMarkup(<Inspector selected={selected} onShapeStyle={onShapeStyle} onFrameStyle={noOp} onRename={noOp} onGeometry={noOp}
    onRotation={noOp} onOpacity={noOp} onShadow={noOp} onBlur={noOp} onMask={noOp} onTextContent={noOp} onTextStyle={noOp} onTextMarkRange={noOp}
    onFrameLayout={noOp} onSizeConstraint={noOp} onImageStyle={noOp} onPath={noOp} onDuplicate={noOp} onDelete={noOp} onReorder={noOp}
    onExportFrame={noOp} onCopyId={noOp} isExporting={false} onCreateComponent={noOp} onGoToDefinition={noOp} onSetOverride={noOp}
    onResetOverride={noOp} onDetach={noOp} />);
}

test("塗りと線は、未設定なら＋、設定済みなら−を見出しに出し、中身は設定済みのときだけ出す", () => {
  const empty = inspect(rectangle({ style: { fill: null, stroke: null } }));
  assert.match(empty, /aria-label="塗りを追加"/);
  assert.match(empty, /aria-label="線を追加"/);
  assert.doesNotMatch(empty, /fill-editor|stroke-editor/);
  const filled = inspect(rectangle({ style: { fill: "#112233", stroke: { color: "#445566", width: 2 } } }));
  assert.match(filled, /aria-label="塗りを外す"/);
  assert.match(filled, /aria-label="線を外す"/);
  assert.match(filled, /class="fill-editor"/);
  assert.match(filled, /class="stroke-editor"/);
  assert.doesNotMatch(filled, /<option value="none"/);
  assert.ok(hasStroke(rectangle({ style: { stroke: null, border: { top: { color: "#000000", width: 1 } } } }).style));
  assert.ok(!hasStroke(ellipse({ style: { stroke: null } }).style));
});

test("線は矩形とフレームで全辺・上・右・下・左を切り換え、角丸があるときと楕円では全辺だけにする", () => {
  const sides = renderToStaticMarkup(<StrokeEditor style={rectangle({ style: { stroke: { color: "#000000", width: 1 }, cornerRadii: square } }).style} onChange={noOp} />);
  assert.deepEqual([...sides.matchAll(/role="radio"[^>]*>([^<]+)</g)].map(([, label]) => label), ["全辺", "上", "右", "下", "左"]);
  assert.match(sides, /太さ/);
  const rounded = rectangle({ style: { stroke: { color: "#000000", width: 1 }, cornerRadii: { topLeft: 4, topRight: 4, bottomRight: 4, bottomLeft: 4 } } });
  const roundedMarkup = renderToStaticMarkup(<StrokeEditor style={rounded.style} onChange={noOp} />);
  assert.doesNotMatch(roundedMarkup, /role="radiogroup"/);
  assert.match(roundedMarkup, /角丸が 0 のときだけ/);
  assert.doesNotMatch(renderToStaticMarkup(<StrokeEditor style={ellipse({ style: { stroke: { color: "#000000", width: 1 } } }).style} onChange={noOp} />), /role="radiogroup"/);
  assert.match(inspect(frame({ style: { stroke: { color: "#000000", width: 1 }, cornerRadii: square } })), /aria-label="線を引く辺"/);
});

test("角丸は1つの値でまとめ、隅ごとに違うときは4隅を出す", () => {
  const same = { topLeft: 6, topRight: 6, bottomRight: 6, bottomLeft: 6 };
  const mixed = { topLeft: 6, topRight: 0, bottomRight: 6, bottomLeft: 0 };
  assert.equal(uniformRadius(same), 6);
  assert.equal(uniformRadius(mixed), null);
  const single = renderToStaticMarkup(<CornerRadiiEditor radii={same} onChange={noOp} />);
  assert.match(single, />角丸<\/label><input[^>]*value="6"/);
  assert.doesNotMatch(single, /左上/);
  const separate = renderToStaticMarkup(<CornerRadiiEditor radii={mixed} onChange={noOp} />);
  assert.match(separate, /aria-pressed="true"/);
  assert.match(separate, /placeholder="混在"/);
  assert.deepEqual([...separate.matchAll(/>(左上|右上|左下|右下)<\/label><input[^>]*value="(\d+)"/g)].map(([, label, value]) => `${label}=${value}`),
    ["左上=6", "右上=0", "左下=0", "右下=6"]);
});
