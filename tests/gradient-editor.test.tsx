import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { addStop, FillEditor, moveStop, switchFillKind } from "../src/pages/editor/components/molecules/FillEditor/FillEditor.tsx";
import type { LinearFill, RadialFill } from "../src/document/types.ts";

const stops = [{ position: 0, color: "#ffffff" }, { position: 0.6, color: "#888888" }, { position: 1, color: "#000000" }];
const linear: LinearFill = { type: "linear", start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, stops };
const radial: RadialFill = { type: "radial", center: { x: 0.5, y: 0.5 }, radius: 1, stops: stops.slice(0, 2) };

test("帯の位置に色の位置を足し、左隣の色を引き継いで選ぶ", () => {
  assert.deepEqual(addStop(stops, 0.3), { stops: [stops[0], { position: 0.3, color: "#ffffff" }, stops[1], stops[2]], index: 1 });
  assert.deepEqual(addStop(stops, 0.8).index, 2);
  assert.deepEqual(addStop(stops, 1.5).stops.at(-1), { position: 1, color: "#000000" });
});

test("色の位置を動かすと並べ直し、動かした色の位置を選んだままにする", () => {
  const moved = moveStop(stops, 1, 0.1);
  assert.deepEqual(moved.stops.map((stop) => stop.position), [0, 0.1, 1]);
  assert.equal(moved.index, 1);
  const past = moveStop(stops, 0, 0.9);
  assert.deepEqual(past.stops.map((stop) => stop.color), ["#888888", "#ffffff", "#000000"]);
  assert.equal(past.index, 1);
});

test("単色・線形・放射状を切り換え、色を引き継ぐ", () => {
  assert.equal(switchFillKind(linear, "solid"), "#ffffff");
  assert.deepEqual((switchFillKind("#123456", "linear") as LinearFill).stops[0], { position: 0, color: "#123456" });
  assert.equal((switchFillKind(linear, "radial") as RadialFill).stops.length, 3);
});

test("帯の下に札を並べて選んだ札を紫にし、選んだ色の位置と始点・終点か中心・半径を入力する", () => {
  const markup = renderToStaticMarkup(<FillEditor fill={linear} onChange={() => {}} />);
  assert.match(markup, /aria-label="塗りの種類"/);
  assert.match(markup, /class="gradient-bar" style="background:linear-gradient\(90deg, #ffffff 0%, #888888 60%, #000000 100%\)"/);
  assert.equal(markup.match(/class="gradient-marker[" ]/g)?.length, 3);
  assert.equal(markup.match(/class="gradient-marker is-selected"/g)?.length, 1);
  assert.match(markup, />位置<\/label><input[^>]*value="0"/);
  assert.match(markup, /aria-label="色の位置を削除"/);
  for (const label of ["始点 X", "始点 Y", "終点 X", "終点 Y"]) assert.ok(markup.includes(`>${label}</label>`), label);
  const round = renderToStaticMarkup(<FillEditor fill={radial} onChange={() => {}} />);
  assert.match(round, /radial-gradient\(circle/);
  assert.match(round, /<button disabled=""[^>]*aria-label="色の位置を削除"/);
  for (const label of ["中心 X", "中心 Y", "半径"]) assert.ok(round.includes(`>${label}</label>`), label);
  assert.doesNotMatch(renderToStaticMarkup(<FillEditor fill="#ff0000" onChange={() => {}} />), /gradient-bar/);
});
