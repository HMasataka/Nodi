import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { createAgentApi } from "../src/agent/api.ts";
import { createHistory } from "../src/document/history.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { resolveDocumentInstances } from "../src/document/instances.ts";
import { setInstanceOverride } from "../src/document/commands/index.ts";
import { component, document, frame, instance, success, text } from "./support/factories.ts";
import type { Document, InstanceNode } from "../src/document/types.ts";
import { InstanceOverrides, overrideTexts } from "../src/pages/editor/components/molecules/InstanceOverrides/InstanceOverrides.tsx";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

// 「凡例」を中に置いた「カード」。凡例のインスタンスは自身のオーバーライドで文言を「内側」にしている。
const legend = component({ id: "cp_legend", name: "凡例", node: frame({ id: "legend-root", children: [text({ id: "legend-label", name: "ラベル", content: "Legend" })] }) });
const card = component({ id: "cp_card", name: "カード", node: frame({ id: "card-root", children: [
  text({ id: "card-title", name: "見出し", content: "Card" }),
  instance({ id: "legend-use", name: "Legend", componentRef: "cp_legend", overrides: { "legend-label": { content: "内側" } } }),
] }) });

function design(overrides: InstanceNode["overrides"] = {}): Document {
  return { ...document(instance({ id: "card", componentRef: "cp_card", overrides })), components: [legend, card] };
}

function resolvedLabel(doc: Document) {
  const [root] = resolveDocumentInstances(doc).children;
  if (root.type !== "frame") return undefined;
  const nested = root.children[1];
  if (nested.type !== "frame") return undefined;
  return nested.children[0];
}

test("外側のインスタンスから `入れ子のインスタンスID/子のID` で中の子を上書きし、内側の上書きより優先する", () => {
  const inner = resolvedLabel(design());
  assert.equal(inner?.type === "text" ? inner.content : undefined, "内側");
  const outer = resolvedLabel(design({ "legend-use/legend-label": { content: "外側", color: "#ff0000" } }));
  assert.equal(outer?.type === "text" ? outer.content : undefined, "外側");
  assert.equal(outer?.type === "text" ? outer.style.color : undefined, "#ff0000");
  const [root] = resolveDocumentInstances(design({ "legend-use": { visible: false } })).children;
  assert.equal(root.type === "frame" ? root.children[1].visible : undefined, false);
});

test("パスのオーバーライドを保存し、存在しないパスと `/` を含む要素の ID は読み込みで拒否する", () => {
  const original = design({ "legend-use/legend-label": { content: "外側" } });
  const json = JSON.parse(success(serializeDocument(original)));
  assert.deepEqual(success(parseDocument(JSON.stringify(json))), original);
  for (const key of ["missing", "legend-use/missing", "card-title/legend-label", "legend-use/", "/legend-use"]) {
    const broken = { ...json, children: [{ ...json.children[0], overrides: { [key]: { content: "x" } } }] };
    assert.equal(parseDocument(JSON.stringify(broken)).type, "Failure", key);
  }
  const slashed = { ...json, children: [{ ...json.children[0], id: "card/1" }] };
  assert.equal(parseDocument(JSON.stringify(slashed)).type, "Failure");
});

test("編集と MCP で、パスのオーバーライドを設定し、存在しないパスはエラーにする", () => {
  const updated = success(setInstanceOverride(design(), "card", "legend-use/legend-label", { content: "外側" }));
  const node = updated.children[0];
  assert.deepEqual(node.type === "instance" ? node.overrides : undefined, { "legend-use/legend-label": { content: "外側" } });
  assert.match((setInstanceOverride(design(), "card", "legend-use/missing", { content: "x" }) as { error: Error }).error.message, /legend-use\/missing/);

  let current = design();
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null, apply: (next) => { current = next; } });
  assert.equal(dispatchAgentRequest(api, "set_instance_override", { id: "card", childId: "legend-use/legend-label", content: "MCP" }).ok, true);
  assert.equal(dispatchAgentRequest(api, "set_instance_override", { id: "card", childId: "legend-use/nope", content: "MCP" }).ok, false);
  assert.equal(dispatchAgentRequest(api, "reset_instance_override", { id: "card", childId: "legend-use/legend-label" }).ok, true);
  const reset = current.children[0];
  assert.deepEqual(reset.type === "instance" ? reset.overrides : undefined, {});
});

test("上書きの行に入れ子のインスタンスの中のテキストも並べ、名前をたどった順に出す", () => {
  assert.deepEqual(overrideTexts(card.node, [legend, card]).map(({ key, label, base }) => [key, label, base]),
    [["card-title", "見出し", "Card"], ["legend-use/legend-label", "Legend › ラベル", "内側"]]);
  const markup = renderToStaticMarkup(<InstanceOverrides node={card.node} components={[legend, card]}
    overrides={{ "legend-use/legend-label": { content: "外側" } }} onSetOverride={() => {}} onResetOverride={() => {}} />);
  assert.match(markup, />Legend › ラベル<\/label><input id="override-legend-use\/legend-label"[^>]*value="外側"/);
  assert.match(markup, /class="override-row is-overridden"/);
});
