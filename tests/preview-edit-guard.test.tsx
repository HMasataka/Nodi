import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { useEditorDocument } from "../src/pages/editor/hooks/useEditorDocument.ts";
import { rectangle, success } from "./support/factories.ts";

test("ドラッグのプレビュー中はMCPと直接編集・ファイル操作を拒否し、終了後だけ再開する", async () => {
  let session: ReturnType<typeof useEditorDocument>;
  function Harness() {
    session = useEditorDocument();
    return null;
  }
  renderToStaticMarkup(<Harness />);
  const original = session!.designRef.current;
  session!.beginPreview();
  session!.previewDocument({ ...original, children: [rectangle()] });
  assert.equal(success(session!.agentApi.getState()).document.children.length, 1);
  for (const result of [
    session!.agentApi.add({ type: "rectangle", x: 0, y: 0, width: 10, height: 10 }),
    session!.agentApi.setRotation("rectangle", 30),
    session!.agentApi.delete("rectangle"),
    session!.agentApi.duplicate("rectangle"),
  ]) assert.match(result.type === "Failure" ? result.error.message : "", /ドラッグ中/);
  const preview = session!.designRef.current;
  session!.recordDocument({ ...preview, children: [] });
  await session!.saveFile();
  await session!.openFile();
  assert.equal(session!.designRef.current, preview);
  assert.equal(success(session!.agentApi.listRevisions()).revisions.length, 1);
  session!.finishPreview(false);
  assert.equal(session!.designRef.current, original);
  success(session!.agentApi.add({ type: "rectangle", x: 0, y: 0, width: 10, height: 10 }));
  assert.equal(success(session!.agentApi.listRevisions()).revisions.length, 2);
});
