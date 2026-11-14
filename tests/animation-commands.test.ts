import assert from "node:assert/strict";
import { test } from "vitest";

import { addAnimation, addKeyframe, removeAnimation, removeKeyframe, setAnimationTiming, setKeyframe } from "../src/document/commands/index.ts";
import { commit, createHistory, redo, undo } from "../src/document/history.ts";
import { document, rectangle, success } from "./support/factories.ts";

test("アニメーションを追加・削除し、Undo / Redo できる", () => {
  const original = document(rectangle());
  const added = success(addAnimation(original, "rectangle", { name: "フェード", trigger: "load" }));
  assert.equal(added.animation.id.startsWith("an_"), true);
  assert.equal(added.document.children[0].animations.length, 1);
  const history = commit(createHistory(original), added.document);
  assert.deepEqual(undo(history).present, original);
  assert.deepEqual(redo(undo(history)).present, added.document);
  assert.equal(success(removeAnimation(added.document, "rectangle", added.animation.id)).children[0].animations.length, 0);
  assert.equal(removeAnimation(added.document, "rectangle", "missing").type, "Failure");
});

test("タイミング（長さ・遅延・繰り返し）を編集できる", () => {
  const added = success(addAnimation(document(rectangle()), "rectangle", { name: "a", trigger: "load" }));
  const edited = success(setAnimationTiming(added.document, "rectangle", added.animation.id, { duration: 500, delay: 100, repeat: 3 }));
  const a = edited.children[0].animations[0];
  assert.deepEqual([a.duration, a.delay, a.repeat], [500, 100, 3]);
  for (const invalid of [{ duration: 0 }, { delay: -1 }, { repeat: 0 }, { repeat: 1.5 }, { trigger: "resize" }]) {
    assert.equal(setAnimationTiming(added.document, "rectangle", added.animation.id, invalid as never).type, "Failure");
  }
});

test("キーフレームを追加・編集・削除し、トラックを管理する", () => {
  const added = success(addAnimation(document(rectangle()), "rectangle", { name: "a", trigger: "load" }));
  const id = added.animation.id;
  let doc = success(addKeyframe(added.document, "rectangle", id, "x", { time: 500, value: 100, easing: "ease-in" }));
  const track = doc.children[0].animations[0].tracks.find((t) => t.property === "x");
  assert.deepEqual(track?.keyframes.map((k) => k.time), [500]);
  doc = success(setKeyframe(doc, "rectangle", id, "x", 500, { value: 200, easing: "ease-out", time: 300 }));
  assert.equal(doc.children[0].animations[0].tracks.find((t) => t.property === "x")?.keyframes[0].value, 200);
  assert.equal(doc.children[0].animations[0].tracks.find((t) => t.property === "x")?.keyframes[0].time, 300);
  doc = success(removeKeyframe(doc, "rectangle", id, "x", 300));
  assert.equal(doc.children[0].animations[0].tracks.some((t) => t.property === "x"), false);
  assert.equal(addKeyframe(doc, "rectangle", id, "width" as never, { time: 0, value: 1, easing: "linear" }).type, "Failure");
});

test("最後のキーフレームを削除するとアニメーションごと消える", () => {
  const added = success(addAnimation(document(rectangle()), "rectangle", { name: "a", trigger: "load" }));
  const id = added.animation.id;
  const track = added.document.children[0].animations[0].tracks[0];
  let doc = added.document;
  for (const keyframe of track.keyframes) {
    doc = success(removeKeyframe(doc, "rectangle", id, track.property, keyframe.time));
  }
  assert.equal(doc.children[0].animations.length, 0);
});
