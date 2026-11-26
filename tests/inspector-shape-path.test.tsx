import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import type { DocumentNode } from "../src/document/types.ts";
import { Inspector } from "../src/pages/editor/components/organisms/Inspector/Inspector.tsx";

import { ellipse, path, rectangle } from "./support/factories.ts";

const noOp = () => {};
const inspect = (selected: DocumentNode) => renderToStaticMarkup(<Inspector selected={selected} onShapeStyle={noOp} onFrameStyle={noOp} onRename={noOp}
  onGeometry={noOp} onRotation={noOp} onOpacity={noOp} onShadow={noOp} onBlur={noOp} onMask={noOp} onTextContent={noOp} onTextStyle={noOp}
  onTextMarkRange={noOp} onFrameLayout={noOp} onSizeConstraint={noOp} onImageStyle={noOp} onPath={noOp} onDuplicate={noOp} onDelete={noOp}
  onReorder={noOp} onExportFrame={noOp} onCopyId={noOp} isExporting={false} onCreateComponent={noOp} onGoToDefinition={noOp}
  onSetOverride={noOp} onResetOverride={noOp} onDetach={noOp} />);

test("矩形と楕円はマスクの節に「マスクとして使う」のチェックボックスを置く", () => {
  assert.match(inspect(rectangle({ isMask: true })), /<label class="checkbox"><input type="checkbox" checked=""[^>]*\/>.*?マスクとして使う/);
  assert.match(inspect(ellipse()), /<label class="checkbox"><input type="checkbox"\/>.*?マスクとして使う/);
});

test("パスの節に点の編集への行と、非ゼロ・偶奇の塗りの規則を置く", () => {
  const node = path({ fillRule: "evenodd", commands: [{ kind: "move", x: 0, y: 0 }, { kind: "line", x: 1, y: 0 }, { kind: "line", x: 1, y: 1 }, { kind: "close" }] });
  const markup = inspect(node);
  assert.match(markup, /class="link-row"><span>点を編集<\/span><span class="link-row-note">3 点<\/span>/);
  assert.match(markup, /aria-label="塗りの規則"/);
  assert.match(markup, /aria-checked="true"[^>]*>偶奇</);
  assert.doesNotMatch(markup, /中間点/);
});
