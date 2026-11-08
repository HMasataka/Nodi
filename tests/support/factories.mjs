import assert from "node:assert/strict";

export function success(result) {
  assert.equal(result.type, "Success");
  return result.value;
}

export function failure(result) {
  assert.equal(result.type, "Failure");
  return result.error;
}

export function document(...children) {
  return { version: 1, children };
}

export function frame(overrides = {}) {
  return {
    id: "frame", name: "画面", type: "frame", x: 0, y: 0, width: 300, height: 200,
    background: "#ffffff", clipContent: true, children: [], ...overrides,
  };
}

export function rectangle(overrides = {}) {
  return {
    id: "rectangle", name: "矩形", type: "rectangle", x: 0, y: 0, width: 100, height: 50,
    fill: "#f3d9c8", stroke: "#d9bbaa", strokeWidth: 1, cornerRadius: 2, ...overrides,
  };
}

export function ellipse(overrides = {}) {
  return {
    id: "ellipse", name: "楕円", type: "ellipse", x: 0, y: 0, width: 100, height: 100,
    fill: "#f3d9c8", stroke: "#d9bbaa", strokeWidth: 1, ...overrides,
  };
}

export function text(overrides = {}) {
  return {
    id: "text", name: "テキスト", type: "text", x: 0, y: 0, width: 200, height: 40,
    content: "テキスト", fontSize: 16, color: "#272b29", textAlign: "left", ...overrides,
  };
}

export function image(overrides = {}) {
  return {
    id: "image", name: "画像", type: "image", x: 0, y: 0, width: 100, height: 100,
    source: "data:image/png;base64,aGVsbG8=", ...overrides,
  };
}
