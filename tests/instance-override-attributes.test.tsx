import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { createAgentApi } from "../src/agent/api.ts";
import { createHistory } from "../src/document/history.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { resolveDocumentLayout } from "../src/document/layout.ts";
import { setInstanceOverride } from "../src/document/commands/index.ts";
import { applyOverride, resolveDocumentInstances } from "../src/document/instances.ts";
import { component, corners, document, frame, image, instance, rectangle, success, text } from "./support/factories.ts";
import type { Document, InstanceNode } from "../src/document/types.ts";
import { InstanceOverrides, overriddenAttributes } from "../src/pages/editor/components/molecules/InstanceOverrides/InstanceOverrides.tsx";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

// 縦に並べたタブの一覧。インスタンスで横並びにしたり、ラベルの太さを変えたりする。
const tabs = component({ id: "cp_tabs", name: "タブ", node: frame({ id: "tabs-root", width: 300, height: 40, layoutMode: "vertical", gap: 4, paddingRef: "sp_tab", children: [
  rectangle({ id: "tab-a", width: 60, height: 20 }),
  rectangle({ id: "tab-b", width: 60, height: 20 }),
  text({ id: "tab-label", name: "ラベル", width: 60, height: 20, content: "Home" }),
] }) });

function design(overrides: InstanceNode["overrides"] = {}): Document {
  return { ...document(instance({ id: "use", componentRef: "cp_tabs", width: 300, height: 40, overrides })), components: [tabs], spacing: [{ id: "sp_tab", name: "タブ", value: 6 }] };
}

test("不透明度・角丸・フレームのレイアウト・文字のスタイルを上書きし、余白を直接指定したら共通余白の参照を外す", () => {
  const root = applyOverride(tabs.node, { opacity: 0.5, cornerRadii: corners(8), layoutMode: "horizontal", padding: 0, alignItems: "center", justifyContent: "space-between" });
  assert.equal(root.type, "frame");
  if (root.type !== "frame") return;
  assert.deepEqual([root.opacity, root.style.cornerRadii, root.layoutMode, root.padding, root.paddingRef, root.alignItems, root.justifyContent, root.gap],
    [0.5, corners(8), "horizontal", 0, undefined, "center", "space-between", 4]);
  const kept = applyOverride(tabs.node, { gap: 10 });
  assert.deepEqual(kept.type === "frame" ? [kept.paddingRef, kept.gap] : [], ["sp_tab", 10]);
  const label = applyOverride(text({ style: { color: "#000000" } }), { fontSize: 20, fontWeight: 700, fontFamily: "serif", lineHeight: 1.2, letterSpacing: 1, textAlign: "center", color: "#ff0000" });
  assert.deepEqual(label.type === "text" ? label.style : undefined,
    { fontSize: 20, color: "#ff0000", textAlign: "center", fontFamily: "serif", fontWeight: 700, lineHeight: 1.2, letterSpacing: 1 });
  const picture = applyOverride(image(), { cornerRadii: corners(4) });
  assert.deepEqual(picture.type === "image" ? picture.style.cornerRadii : undefined, corners(4));
});

test("上書きしたレイアウトで自動レイアウトを解く", () => {
  const resolved = resolveDocumentLayout(resolveDocumentInstances(design({ "tabs-root": { layoutMode: "horizontal", padding: 0, gap: 10 } }))).children[0];
  assert.equal(resolved.type, "frame");
  if (resolved.type !== "frame") return;
  assert.deepEqual(resolved.children.map(({ x, y }) => [x, y]), [[0, 0], [70, 0], [140, 0]]);
});

test("新しい属性を保存し、種類に合わない属性と範囲外の値は読み込みで拒否する", () => {
  const original = design({ "tabs-root": { layoutMode: "horizontal", padding: 0 }, "tab-label": { fontWeight: 700, opacity: 0.4 }, "tab-a": { cornerRadii: corners(6) } });
  const json = JSON.parse(success(serializeDocument(original)));
  assert.deepEqual(success(parseDocument(JSON.stringify(json))), original);
  for (const overrides of [{ "tab-a": { fontSize: 12 } }, { "tab-label": { padding: 4 } }, { "tab-label": { fontWeight: 650 } }, { "tab-a": { opacity: 2 } }]) {
    const broken = { ...json, children: [{ ...json.children[0], overrides }] };
    assert.equal(parseDocument(JSON.stringify(broken)).type, "Failure", JSON.stringify(overrides));
  }
});

test("編集と MCP で新しい属性を上書きし、種類に合わない属性や範囲外の値はエラーにする", () => {
  const updated = success(setInstanceOverride(design(), "use", "tab-label", { fontSize: 18, textAlign: "right" }));
  const node = updated.children[0];
  assert.deepEqual(node.type === "instance" ? node.overrides["tab-label"] : undefined, { fontSize: 18, textAlign: "right" });
  assert.match((setInstanceOverride(design(), "use", "tab-a", { fontSize: 18 }) as { error: Error }).error.message, /fontSize/);
  assert.equal(setInstanceOverride(design(), "use", "tabs-root", { padding: -1 }).type, "Failure");
  assert.equal(setInstanceOverride(design(), "use", "tab-label", { fontWeight: 450 }).type, "Failure");

  let current = design();
  const api = createAgentApi({ getDocument: () => current, getHistory: () => createHistory(current), getSelectedId: () => null, apply: (next) => { current = next; } });
  assert.equal(dispatchAgentRequest(api, "set_instance_override", { id: "use", childId: "tabs-root", layoutMode: "horizontal", gap: 8 }).ok, true);
  assert.equal(dispatchAgentRequest(api, "set_instance_override", { id: "use", childId: "tab-a", opacity: 0.3, cornerRadii: corners(2) }).ok, true);
  assert.equal(dispatchAgentRequest(api, "set_instance_override", { id: "use", childId: "tab-a", fontWeight: 700 }).ok, false);
  const use = current.children[0];
  assert.deepEqual(use.type === "instance" ? use.overrides : undefined,
    { "tabs-root": { layoutMode: "horizontal", gap: 8 }, "tab-a": { opacity: 0.3, cornerRadii: corners(2) } });
});

test("プロパティの上書きに、文言以外の上書きを要素ごとの行で並べ、行ごとに戻せる", () => {
  const overrides = { "tabs-root": { layoutMode: "horizontal" as const, gap: 8 }, "tab-label": { content: "Top" } };
  assert.deepEqual(overriddenAttributes(tabs.node, [tabs], overrides), [{ key: "tabs-root", label: "画面", names: ["並べ方", "間隔"] }]);
  const markup = renderToStaticMarkup(<InstanceOverrides node={tabs.node} components={[tabs]} overrides={overrides} onSetOverride={() => {}} onResetOverride={() => {}} />);
  assert.match(markup, /value="Top"/);
  assert.match(markup, /title="画面">画面<\/span><span class="override-row-value override-row-summary">並べ方・間隔<\/span>/);
  assert.match(markup, /aria-label="画面の上書きを元に戻す"/);
});
