import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { Canvas } from "../src/pages/editor/components/organisms/Canvas/Canvas.tsx";
import { movePathPoint } from "../src/document/pathEdit.ts";
import { resolveDocumentLayout } from "../src/document/layout.ts";
import { snapMove } from "../src/pages/editor/snapping.ts";
import { cameraScreenGeometry, cameraWorldPoint, focusCamera, INITIAL_CAMERA, initialCamera, zoomCamera } from "../src/pages/editor/camera.ts";
import { composeTransform, invertTransform, nodeTransform, transformPoint } from "../src/document/transform.ts";
import { createHistory, isDirty } from "../src/document/history.ts";
import { document, frame, path, rectangle } from "./support/factories.ts";
import { drawingGeometry, nodesInBounds, resizeFromWorldDelta } from "../src/pages/editor/geometry.ts";
import { panScroll, screenDeltaToDocument } from "../src/pages/editor/viewport.ts";

test("原点を越えて全方向へパンでき、任意の表示位置でズームの支点が変わらない", () => {
  const start = { ...INITIAL_CAMERA, pointerId: 1, clientX: 100, clientY: 200 };
  const camera = { ...INITIAL_CAMERA, ...panScroll(start, { clientX: 50100, clientY: 80200 }) };
  assert.deepEqual([camera.scrollLeft, camera.scrollTop], [-50064, -80064]);
  const point = { x: 230, y: 175 };
  const anchor = cameraWorldPoint(camera, point);
  for (const zoom of [0.25, 0.8, 2, 4]) {
    const next = zoomCamera(camera, zoom, point);
    const mapped = cameraScreenGeometry({ ...anchor, width: 20, height: 10 }, next);
    assert.ok(Math.abs(mapped.x - point.x) < 1e-8);
    assert.ok(Math.abs(mapped.y - point.y) < 1e-8);
  }
  const returned = panScroll({ ...camera, pointerId: 1, clientX: 50100, clientY: 80200 }, { clientX: 100, clientY: 200 });
  assert.deepEqual(returned, { scrollLeft: -64, scrollTop: -64 });
});

test("初期表示は最初のフレームを中央に置き、負座標・回転・空文書も扱う", () => {
  const size = { width: 800, height: 600 };
  assert.deepEqual(initialCamera(document(), size), INITIAL_CAMERA);
  const first = frame({ x: -2000, y: -800, width: 1000, height: 500, rotation: 90 });
  const design = document(rectangle({ x: 9000, y: 9000 }), first, frame({ id: "other", x: 6000 }));
  const snapshot = structuredClone(design);
  const history = createHistory(design, true);
  const camera = initialCamera(design, size);
  const center = cameraScreenGeometry({ x: first.x + first.width / 2, y: first.y + first.height / 2, width: 0, height: 0 }, camera);
  assert.ok(Math.abs(center.x - 400) < 1e-9 && Math.abs(center.y - 300) < 1e-9);
  assert.ok(camera.zoom < 1);
  assert.ok(camera.scrollLeft < 0 && camera.scrollTop < 0);
  assert.deepEqual(design, snapshot);
  assert.equal(isDirty(history), false);
  const small = focusCamera({ x: 0, y: 0, width: 100, height: 80 }, size, 1);
  assert.deepEqual(small, { zoom: 1, scrollLeft: -350, scrollTop: -260 });
});

test("パン・ズーム後の選択、描画、パス編集、移動量、リサイズは文書座標で一致する", () => {
  const camera = { zoom: 2, scrollLeft: -2000, scrollTop: -1200 };
  const parent = frame({ x: -900, y: -500, width: 300, height: 200, rotation: 90 });
  const node = path({ x: 20, y: 30, width: 100, height: 50, rotation: 30 });
  const world = composeTransform(nodeTransform(parent), nodeTransform(node));
  const local = { x: 40, y: 20 };
  const worldPoint = transformPoint(world, local);
  const screen = cameraScreenGeometry({ ...worldPoint, width: 0, height: 0 }, camera);
  const recovered = transformPoint(invertTransform(world), cameraWorldPoint(camera, screen));
  assert.ok(Math.abs(recovered.x - local.x) < 1e-9 && Math.abs(recovered.y - local.y) < 1e-9);
  const edited = movePathPoint(node.commands, 1, "anchor", { x: recovered.x / node.width, y: recovered.y / node.height });
  assert.ok(edited);
  assert.ok(Math.abs(edited[1].x - 0.4) < 1e-9);
  const start = transformPoint(nodeTransform(parent), { x: 10, y: 15 });
  const end = transformPoint(nodeTransform(parent), { x: 60, y: 55 });
  const toScreen = (point) => cameraScreenGeometry({ ...point, width: 0, height: 0 }, camera);
  assert.deepEqual(drawingGeometry(cameraWorldPoint(camera, toScreen(start)), cameraWorldPoint(camera, toScreen(end)), nodeTransform(parent)),
    { x: 10, y: 15, width: 50, height: 40 });
  const rect = rectangle({ x: -900, y: -500 });
  const region = drawingGeometry(cameraWorldPoint(camera, { x: 198, y: 198 }), cameraWorldPoint(camera, { x: 402, y: 302 }));
  assert.deepEqual(nodesInBounds(document(rect), region), [rect.id]);
  assert.equal(screenDeltaToDocument(40, camera.zoom), 20);
  const delta = { x: 0, y: screenDeltaToDocument(40, camera.zoom) };
  const resized = resizeFromWorldDelta({ ...node, rotation: 0 }, nodeTransform(parent), delta);
  assert.equal(resized.width, 120);
  assert.equal(resized.height, 50);
  const snapped = snapMove(document(rect, rectangle({ id: "target", x: -780, y: -500 })), [rect.id], 19, 0, camera.zoom);
  assert.equal(snapped.dx, 20);
});

test("キャンバスは固定の表示領域に仮想原点を適用し、レイアウト解決後の位置へフォーカスできる", () => {
  const noOp = () => {};
  const camera = { zoom: 0.5, scrollLeft: -10000, scrollTop: 8000 };
  const design = document(frame({ x: -300, y: -200 }));
  const markup = renderToStaticMarkup(<Canvas design={design} selectedId={null} zoom={camera.zoom} camera={camera}
    onZoom={noOp} drawTool="select" drawing={null} pen={null} onPanPointerDown={noOp} onPanPointerMove={noOp} onPanPointerUp={noOp}
    onWorldPointerDown={noOp} onWorldDoubleClick={noOp} onWorldPointerMove={noOp} onWorldPointerUp={noOp} onWorldPointerCancel={noOp}
    onNodePointerDown={noOp} onResizePointerDown={noOp} onNodePointerMove={noOp} onNodePointerUp={noOp} onImageError={noOp} />);
  assert.match(markup, /translate\(10000px, -8000px\) scale\(0.5\)/);
  assert.match(markup, /background-position:9999px -8001px/);
  assert.doesNotMatch(markup, /max\(100%/);
  const resolved = resolveDocumentLayout(design);
  const target = focusCamera(resolved.children[0], { width: 800, height: 600 }, 1);
  assert.deepEqual(cameraScreenGeometry(resolved.children[0], target), { x: 250, y: 200, width: 300, height: 200 });
});
