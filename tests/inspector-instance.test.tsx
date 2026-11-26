import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { Inspector } from "../src/pages/editor/components/organisms/Inspector/Inspector.tsx";
import { InstanceOverrides } from "../src/pages/editor/components/molecules/InstanceOverrides/InstanceOverrides.tsx";

import { frame, instance, text } from "./support/factories.ts";

const noOp = () => {};
const definition = frame({ id: "root", children: [text({ id: "title", name: "Title", content: "Quiet objects" }), text({ id: "meta", name: "Meta", content: "2026" })] });

test("上書きの行に名前・値・戻すを並べ、上書きしていない行は戻せない", () => {
  const markup = renderToStaticMarkup(<InstanceOverrides node={definition} overrides={{ title: { content: "Everyday forms" } }} onSetOverride={noOp} onResetOverride={noOp} />);
  assert.match(markup, /<div class="override-row is-overridden"><label[^>]*>Title<\/label><input[^>]*value="Everyday forms"/);
  assert.match(markup, /<div class="override-row"><label[^>]*>Meta<\/label><input[^>]*value="2026"/);
  assert.match(markup, /<button type="button" class="icon-button" aria-label="Titleを元に戻す"/);
  assert.match(markup, /<button disabled=""[^>]*aria-label="Metaを元に戻す"/);
});

test("コンポーネントの節に参照元へのリンクと切り離しを置く", () => {
  const markup = renderToStaticMarkup(<Inspector selected={instance({ componentRef: "c1" })} componentName="Project card" componentNode={definition}
    onRename={noOp} onGeometry={noOp} onRotation={noOp} onOpacity={noOp} onShadow={noOp} onBlur={noOp} onMask={noOp} onTextContent={noOp}
    onTextStyle={noOp} onTextMarkRange={noOp} onShapeStyle={noOp} onFrameStyle={noOp} onFrameLayout={noOp} onSizeConstraint={noOp}
    onImageStyle={noOp} onPath={noOp} onDuplicate={noOp} onDelete={noOp} onReorder={noOp} onExportFrame={noOp} onCopyId={noOp} isExporting={false}
    onCreateComponent={noOp} onGoToDefinition={noOp} onSetOverride={noOp} onResetOverride={noOp} onDetach={noOp} />);
  assert.match(markup, /class="link-row" title="アセットで参照元を表示"><span>Project card<\/span>/);
  assert.match(markup, /class="button button-secondary">切り離す</);
  assert.equal(markup.match(/class="override-row[" ]/g)?.length, 2);
});
