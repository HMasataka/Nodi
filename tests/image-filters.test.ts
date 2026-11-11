import assert from "node:assert/strict";
import { test } from "vitest";

import { createAgentApi } from "../src/agent/api.ts";
import { DEFAULT_IMAGE_FILTERS } from "../src/document/types.ts";
import { dispatchAgentRequest } from "../src/agent/bridge.ts";
import { renderFramePng } from "../src/export/framePng.ts";
import { setImageFilters } from "../src/document/commands/index.ts";
import { cssImageFilter, filterPixels, hasImageFilters } from "../src/document/imageFilters.ts";
import { document, frame, image, success } from "./support/factories.ts";
import { parseDocument, serializeDocument } from "../src/persistence/format.ts";

test("CSS文字列とCPU処理は明るさから色相まで同じ順序を使う", () => {
  const filters = { ...DEFAULT_IMAGE_FILTERS, brightness: 1.5, contrast: 0.5, saturate: 0.7, grayscale: 0.2, sepia: 0.3, hueRotate: 45 };
  assert.equal(cssImageFilter(filters), "brightness(1.5) contrast(0.5) saturate(0.7) grayscale(0.2) sepia(0.3) hue-rotate(45deg)");
  assert.equal(cssImageFilter(DEFAULT_IMAGE_FILTERS), "none");
  assert.equal(hasImageFilters(DEFAULT_IMAGE_FILTERS), false);
  assert.equal(hasImageFilters(filters), true);
  const input = new Uint8ClampedArray([100, 150, 200, 128]);
  const sequential = ["brightness", "contrast", "saturate", "grayscale", "sepia", "hueRotate"].reduce((pixels, key) =>
    filterPixels(pixels, { ...DEFAULT_IMAGE_FILTERS, [key]: filters[key as keyof typeof filters] }), input);
  filterPixels(input, filters).forEach((value, index) => assert.ok(Math.abs(value - sequential[index]) <= 2));
  assert.deepEqual(Array.from(input), [100, 150, 200, 128]);
});

test("個別のフィルターはRGBを調整し、透明度を変更しない", () => {
  const pixel = new Uint8ClampedArray([100, 150, 200, 128, 255, 100, 0, 0]);
  assert.deepEqual([...filterPixels(pixel, { ...DEFAULT_IMAGE_FILTERS, brightness: 2 })], [200, 255, 255, 128, 0, 0, 0, 0]);
  assert.deepEqual(Array.from(filterPixels(pixel, { ...DEFAULT_IMAGE_FILTERS, contrast: 0 }).slice(0, 4)), [128, 128, 128, 128]);
  const gray = filterPixels(pixel, { ...DEFAULT_IMAGE_FILTERS, grayscale: 1 });
  assert.equal(gray[0], gray[1]);
  assert.equal(gray[1], gray[2]);
  const desaturated = filterPixels(pixel, { ...DEFAULT_IMAGE_FILTERS, saturate: 0 });
  assert.equal(desaturated[0], desaturated[1]);
  assert.equal(desaturated[1], desaturated[2]);
  assert.ok(filterPixels(pixel, { ...DEFAULT_IMAGE_FILTERS, sepia: 1 })[0] > filterPixels(pixel, { ...DEFAULT_IMAGE_FILTERS, sepia: 1 })[2]);
  assert.notDeepEqual(filterPixels(pixel, { ...DEFAULT_IMAGE_FILTERS, hueRotate: 90 }).slice(0, 3), pixel.slice(0, 3));
  assert.deepEqual(filterPixels(pixel, DEFAULT_IMAGE_FILTERS), pixel);
});

test("フィルターの既定値は保存せず、指定値と部分変更は再読込・Undoで保つ", () => {
  const original = document(image());
  assert.deepEqual(JSON.parse(success(serializeDocument(original))).children[0].style, {});
  assert.deepEqual(success(parseDocument(success(serializeDocument(original)))), original);
  const edited = success(setImageFilters(original, "image", { brightness: 1.2, grayscale: 0.4 }));
  assert.deepEqual(edited.children[0].style.filters, { ...DEFAULT_IMAGE_FILTERS, brightness: 1.2, grayscale: 0.4 });
  assert.deepEqual(JSON.parse(success(serializeDocument(edited))).children[0].style.filters, { brightness: 1.2, grayscale: 0.4 });
  assert.deepEqual(success(parseDocument(success(serializeDocument(edited)))), edited);
  assert.deepEqual(original.children[0].style.filters, DEFAULT_IMAGE_FILTERS);
});

test("不正値・未知項目を拒否し、MCPで変更できる", () => {
  const initial = document(image());
  for (const filters of [{ brightness: -1 }, { contrast: Infinity }, { saturate: NaN }, { grayscale: 2 }, { sepia: -1 }, { hueRotate: Infinity }, { blur: 3 }]) {
    assert.equal(setImageFilters(initial, "image", filters).type, "Failure");
    assert.equal(parseDocument(JSON.stringify({ version: 1, children: [{ ...initial.children[0], style: { filters } }] })).type, "Failure");
  }
  let current = initial;
  const api = createAgentApi({ getDocument: () => current, getHistory: () => ({}) as never, getSelectedId: () => null, apply: (next) => { current = next; } });
  assert.equal(dispatchAgentRequest(api, "set_image_filters", { id: "image", filters: { contrast: 0.8, hueRotate: -30 } }).ok, true);
  assert.equal(success(api.getElement("image")).style.filters.contrast, 0.8);
  assert.equal(dispatchAgentRequest(api, "set_image_filters", { id: "image", filters: { bogus: 1 } }).ok, false);
  assert.equal(dispatchAgentRequest(api, "set_image_filters", { id: "image", filters: {} }).ok, false);
});

test("PNGはオフスクリーンで画素を処理し、角丸クリップ後に配置する", async () => {
  const node = image({ width: 2, height: 1, style: { filters: { ...DEFAULT_IMAGE_FILTERS, brightness: 0.5 } } });
  const calls: string[] = [];
  const pixels = { data: new Uint8ClampedArray([100, 50, 0, 128, 200, 100, 50, 0]) };
  const offscreen = { width: 0, height: 0, getContext: () => ({
    scale: () => calls.push("scale"), drawImage: () => calls.push("offscreen.drawImage"),
    getImageData: () => { calls.push("getImageData"); return pixels; },
    putImageData: () => calls.push("putImageData"),
  }) };
  const ctx = { save() {}, restore() {}, translate() {}, beginPath() {}, rect() {}, clip: () => calls.push("clip"),
    moveTo() {}, lineTo() {}, closePath() {}, fill() {}, drawImage: (source: unknown) => {
      assert.equal(source, offscreen);
      calls.push("main.drawImage");
    } };
  let canvases = 0;
  success(await renderFramePng(frame({ width: 2, height: 1, children: [node] }), {
    createCanvas: () => ++canvases === 1 ? { width: 0, height: 0, getContext: () => ctx,
      toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])) } as unknown as HTMLCanvasElement : offscreen as unknown as HTMLCanvasElement,
    loadImage: async () => ({ naturalWidth: 2, naturalHeight: 1 }) as HTMLImageElement,
  }));
  assert.equal(canvases, 2);
  assert.deepEqual(calls.filter((name) => name === "clip").length, 3);
  assert.ok(calls.indexOf("clip") < calls.indexOf("offscreen.drawImage"));
  assert.deepEqual(calls.slice(-3), ["getImageData", "putImageData", "main.drawImage"]);
  assert.deepEqual([...pixels.data], [50, 25, 0, 128, 0, 0, 0, 0]);
});
