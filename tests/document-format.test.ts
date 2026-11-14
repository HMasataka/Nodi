import assert from "node:assert/strict";
import { test } from "vitest";

import type { Animation } from "../src/document/types.ts";
import { createAgentApi } from "../src/agent/api.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { corners, document, ellipse, frame, image, rectangle, success, text } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";
import { setFrameStyle, setNodeStyle } from "../src/document/commands/index.ts";

test("画像の既定角丸は省略し、旧画像 style と非既定値を読み書きする", () => {
  const original = image();
  const plain = JSON.parse(success(serializeDocument(document(original))));
  assert.deepEqual(plain.children[0].style, {});
  assert.deepEqual(success(parseDocument(JSON.stringify(plain))), document(original));
  const custom = { ...original, style: { ...original.style, cornerRadii: { topLeft: 3, topRight: 6, bottomRight: 9, bottomLeft: 12 } } };
  assert.deepEqual(JSON.parse(success(serializeDocument(document(custom)))).children[0].style, { cornerRadii: custom.style.cornerRadii });
  assert.deepEqual(success(parseDocument(success(serializeDocument(document(custom))))), document(custom));
  for (const value of [-1, Infinity, NaN]) {
    assert.equal(serializeDocument(document({ ...custom, style: { ...custom.style, cornerRadii: { ...custom.style.cornerRadii, topLeft: value } } })).type, "Failure");
  }
  assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...custom, style: { cornerRadii: { ...custom.style.cornerRadii, topLeft: -1 } } }] })).type, "Failure");
  assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...custom, style: { cornerRadii: { topLeft: 1 } } }] })).type, "Failure");
});

test("v1 の Wire 形式を再帰的に正規化し、既定値だけを保存から除く", () => {
  const original = document(frame({ children: [
    rectangle({ style: { fill: null, stroke: null, cornerRadii: corners(0) } }),
    ellipse({ style: { stroke: null } }), text(), image(),
    frame({ id: "nested", style: { fill: null }, clipContent: false }),
  ] }));
  const before = structuredClone(original);
  const json = success(serializeDocument(original));
  const wire = JSON.parse(json);
  assert.equal(wire.version, 1);
  const root = wire.children[0];
  assert.deepEqual(root.style, { fill: "#ffffff" });
  assert.equal(Object.hasOwn(root, "clipContent"), false);
  assert.deepEqual(root.children[0].style, { fill: null });
  assert.deepEqual(root.children[1].style, { fill: "#f3d9c8" });
  assert.deepEqual(root.children[2].style, { fontSize: 16, color: "#272b29", textAlign: "left" });
  assert.deepEqual(root.children[3].style, {});
  assert.equal(root.children[4].clipContent, false);
  assert.deepEqual(success(parseDocument(json)), original);
  assert.deepEqual(original, before);
  assert.equal(success(serializeDocument(success(parseDocument(json)))), json);
});

test("非既定値と明示的な null を保持し、ゼロ幅の線を null に変えない", () => {
  const original = document(frame({ clipContent: false, style: { fill: null, stroke: { color: "#123456", width: 0 },
    cornerRadii: { topLeft: 0, topRight: 2, bottomRight: 4, bottomLeft: 8 } }, children: [
    text({ style: { fontFamily: "monospace", fontWeight: 700, lineHeight: 2, letterSpacing: -1 } }),
  ] }));
  const json = success(serializeDocument(original));
  const { border: _border, ...wireStyle } = original.children[0].style;
  assert.deepEqual(JSON.parse(json).children[0].style, wireStyle);
  assert.deepEqual(success(parseDocument(json)), original);
  const explicit = document(rectangle({ style: { stroke: null, cornerRadii: corners(0) } }));
  assert.deepEqual(success(parseDocument(success(serializeDocument(explicit)))), explicit);
});

test("旧開発版の平坦な v1 と version 2 を拒否する", () => {
  const { style, ...base } = rectangle();
  const legacy = { ...base, fill: style.fill, stroke: "#d9bbaa", strokeWidth: 1, cornerRadius: 2 };
  assert.equal(parseDocument(JSON.stringify({ version: 1, children: [legacy] })).type, "Failure");
  assert.equal(parseDocument(JSON.stringify({ version: 2, children: [] })).type, "Failure");
});

test("ノード・style・stroke・cornerRadii・画像の器の未知項目を拒否する", () => {
  const box = rectangle();
  const invalidNodes = [
    { ...box, fill: "#ffffff" },
    { ...box, style: { ...box.style, cornerRadius: 2 } },
    { ...box, style: { ...box.style, stroke: { color: "#000000", width: 1, align: "outside" } } },
    { ...box, style: { ...box.style, cornerRadii: { ...corners(0), extra: 0 } } },
    { ...ellipse(), style: { ...ellipse().style, cornerRadii: corners(0) } },
    { ...text(), style: { ...text().style, fill: null } },
    { ...image(), style: { opacity: 1 } },
    { ...frame(), background: "#ffffff" },
  ];
  for (const node of invalidNodes) {
    const invalid = { version: 1, children: [node] };
    assert.equal(parseDocument(JSON.stringify(invalid)).type, "Failure");
    assert.equal(serializeDocument(invalid).type, "Failure");
  }
});

test("不足した必須スタイルと不正な入れ子値を既定値で隠さない", () => {
  const box = rectangle();
  for (const style of [undefined, {}, { ...box.style, fill: undefined }, { ...box.style, stroke: {} },
    { ...box.style, stroke: { color: "red", width: 1 } }, { ...box.style, stroke: { color: "#123456", width: -1 } },
    { ...box.style, cornerRadii: null }, { ...box.style, cornerRadii: { topLeft: 1 } },
    { ...box.style, cornerRadii: corners(-1) }]) {
    assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...box, style }] })).type, "Failure");
  }
});

test("塗りと線を null にする編集は Undo / Redo・保存で維持される", () => {
  const original = document(frame({ children: [rectangle(), ellipse()] }));
  let edited = success(setNodeStyle(original, "rectangle", { fill: null, stroke: null }));
  edited = success(setNodeStyle(edited, "ellipse", { fill: null, stroke: null }));
  edited = success(setFrameStyle(edited, "frame", { fill: null, stroke: { color: "#123456", width: 2 }, cornerRadii: corners(4) }));
  const history = commit(createHistory(original), edited);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, edited);
  assert.deepEqual(success(parseDocument(success(serializeDocument(edited)))), edited);
  assert.equal(edited.children[0].children[0].style.fill, null);
  assert.equal(edited.children[0].children[1].style.stroke, null);
  assert.equal(original.children[0].children[0].style.fill, "#f3d9c8");
});

test("MCP 用の入れ子 style を変更しても文書や履歴を変更しない", () => {
  const history = createHistory(document(rectangle()));
  const api = createAgentApi({ getDocument: () => history.present, getHistory: () => history, getSelectedId: () => null, apply: () => assert.fail("読み取り専用") });
  const reference = success(api.getElement("rectangle"));
  reference.style.stroke.width = 99;
  reference.style.cornerRadii.topLeft = 99;
  const actual = success(api.getElement("rectangle"));
  assert.equal(actual.style.stroke.width, 1);
  assert.equal(actual.style.cornerRadii.topLeft, 2);
  assert.equal(Object.hasOwn(actual, "fill"), false);
});

test("スタイルの省略パッチは既存値を維持し、入れ子入力を文書と共有しない", () => {
  const original = document(rectangle(), frame());
  assert.deepEqual(success(setNodeStyle(original, "rectangle", { fill: undefined, stroke: undefined, cornerRadii: undefined })), original);
  assert.deepEqual(success(setFrameStyle(original, "frame", { fill: undefined, clipContent: undefined })), original);
  const patch = { stroke: { color: "#123456", width: 3 }, cornerRadii: corners(7) };
  const edited = success(setNodeStyle(original, "rectangle", patch));
  patch.stroke.width = 99;
  patch.cornerRadii.topLeft = 99;
  assert.equal(edited.children[0].style.stroke.width, 3);
  assert.equal(edited.children[0].style.cornerRadii.topLeft, 7);
});

test("フレームのレイアウト設定を読み書きし、既定値は省略して none に補完する", () => {
  const custom = frame({ layoutMode: "vertical", padding: 16, gap: 8, alignItems: "center", justifyContent: "space-between" });
  const json = success(serializeDocument(document(custom)));
  const wire = JSON.parse(json).children[0];
  assert.deepEqual({ layoutMode: wire.layoutMode, padding: wire.padding, gap: wire.gap, alignItems: wire.alignItems, justifyContent: wire.justifyContent },
    { layoutMode: "vertical", padding: 16, gap: 8, alignItems: "center", justifyContent: "space-between" });
  assert.deepEqual(success(parseDocument(json)), document(custom));

  const plain = JSON.parse(success(serializeDocument(document(frame())))).children[0];
  for (const key of ["layoutMode", "padding", "gap", "alignItems", "justifyContent"]) assert.equal(Object.hasOwn(plain, key), false);
  const reloaded = success(parseDocument(success(serializeDocument(document(frame()))))).children[0];
  assert.equal(reloaded.type === "frame" && reloaded.layoutMode, "none");
});

test("子要素のサイズ制約を読み書きし、既定値 fixed は省略する", () => {
  const custom = rectangle({ widthConstraint: { mode: "fill" }, heightConstraint: { mode: "hug", min: 20, max: 200 } });
  const wire = JSON.parse(success(serializeDocument(document(custom)))).children[0];
  assert.deepEqual(wire.widthConstraint, { mode: "fill" });
  assert.deepEqual(wire.heightConstraint, { mode: "hug", min: 20, max: 200 });
  assert.deepEqual(success(parseDocument(success(serializeDocument(document(custom))))), document(custom));

  const plain = JSON.parse(success(serializeDocument(document(rectangle())))).children[0];
  assert.equal(Object.hasOwn(plain, "widthConstraint"), false);
  assert.equal(Object.hasOwn(plain, "heightConstraint"), false);
});

test("レイアウト設定とサイズ制約の未知項目を拒否する", () => {
  const base = rectangle();
  const cases = [
    { ...base, widthConstraint: { mode: "fill", extra: 1 } },
    { ...frame(), layoutMode: "horizontal", extraLayout: true },
  ];
  for (const node of cases) {
    const invalid = { version: 1, children: [node] };
    assert.equal(parseDocument(JSON.stringify(invalid)).type, "Failure");
    assert.equal(serializeDocument(invalid).type, "Failure");
  }
});

test("レイアウト設定とサイズ制約の不正値を拒否する", () => {
  const base = rectangle();
  const cases: unknown[] = [
    { ...base, widthConstraint: { mode: "grow" } },
    { ...base, widthConstraint: { mode: "fill", min: -1 } },
    { ...base, widthConstraint: { mode: "fill", min: 20, max: 10 } },
    { ...base, heightConstraint: null },
    { ...frame(), layoutMode: "grid" },
    { ...frame(), padding: -1 },
    { ...frame(), gap: -1 },
    { ...frame(), alignItems: "stretch" },
    { ...frame(), justifyContent: "between" },
  ];
  for (const node of cases) {
    assert.equal(parseDocument(JSON.stringify({ version: 1, children: [node] })).type, "Failure");
  }
});

function animation(overrides: Partial<Animation> = {}): Animation {
  return {
    id: "anim1", name: "フェード", trigger: "load", duration: 1000, delay: 0, repeat: 1,
    tracks: [{ property: "opacity", keyframes: [{ time: 0, value: 1, easing: "linear" }, { time: 1000, value: 0, easing: "linear" }] }],
    ...overrides,
  };
}

test("アニメーションを読み書きし、既定値（delay 0・repeat 1・easing linear）は省略する", () => {
  const custom = animation({ delay: 200, repeat: 3, tracks: [
    { property: "opacity", keyframes: [{ time: 0, value: 1, easing: "linear" }, { time: 1000, value: 0, easing: "ease-out" }] },
    { property: "x", keyframes: [{ time: 0, value: 0, easing: "linear" }, { time: 500, value: 100, easing: "ease-in-out" }] },
  ] });
  const original = document(rectangle({ animations: [custom] }));
  const wire = JSON.parse(success(serializeDocument(original))).children[0].animations[0];
  assert.equal(wire.delay, 200);
  assert.equal(wire.repeat, 3);
  assert.equal(wire.tracks[0].keyframes[1].easing, "ease-out");
  assert.equal(Object.hasOwn(wire.tracks[0].keyframes[0], "easing"), false);
  assert.deepEqual(success(parseDocument(success(serializeDocument(original)))), original);

  const plain = JSON.parse(success(serializeDocument(document(rectangle({ animations: [animation()] }))))).children[0].animations[0];
  assert.equal(Object.hasOwn(plain, "delay"), false);
  assert.equal(Object.hasOwn(plain, "repeat"), false);
  assert.equal(Object.hasOwn(plain.tracks[0].keyframes[0], "easing"), false);
});

test("アニメーション未指定は空配列に補完し、保存時は省略する", () => {
  const wire = JSON.parse(success(serializeDocument(document(rectangle())))).children[0];
  assert.equal(Object.hasOwn(wire, "animations"), false);
  assert.deepEqual(success(parseDocument(JSON.stringify({ version: 1, children: [wire] }))).children[0].animations, []);
});

test("不正なアニメーションの値と構造を拒否する", () => {
  const cases: unknown[] = [
    { animations: [{ ...animation(), trigger: "resize" }] },
    { animations: [{ ...animation(), duration: 0 }] },
    { animations: [{ ...animation(), delay: -1 }] },
    { animations: [{ ...animation(), repeat: 0 }] },
    { animations: [{ ...animation(), repeat: 1.5 }] },
    { animations: [{ ...animation(), tracks: [] }] },
    { animations: [{ ...animation(), tracks: [{ property: "opacity", keyframes: [] }] }] },
    { animations: [{ ...animation(), tracks: [{ property: "opacity", keyframes: [{ time: 10, value: 1, easing: "linear" }, { time: 5, value: 0, easing: "linear" }] }] }] },
    { animations: [{ ...animation(), tracks: [{ property: "opacity", keyframes: [{ time: 0, value: 1, easing: "bounce" }] }] }] },
    { animations: [{ ...animation(), tracks: [
      { property: "opacity", keyframes: [{ time: 0, value: 1, easing: "linear" }] },
      { property: "opacity", keyframes: [{ time: 0, value: 0, easing: "linear" }] },
    ] }] },
  ];
  for (const node of cases) {
    assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...rectangle(), ...(node as object) }] })).type, "Failure");
  }
});
