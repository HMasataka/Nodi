import assert from "node:assert/strict";
import { test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "../src/pages/editor/components/atoms/Button/Button.tsx";
import { IconButton } from "../src/pages/editor/components/atoms/IconButton/IconButton.tsx";
import { iconPathData } from "../src/pages/editor/components/atoms/Icon/Icon.tsx";

test("アイコンボタンは操作名を aria-label に出し、押された状態を aria-pressed で示す", () => {
  const plain = renderToStaticMarkup(createElement(IconButton, { icon: "trash", label: "削除" }));
  assert.match(plain, /^<button type="button" class="icon-button" aria-label="削除" title="削除">/);
  assert.doesNotMatch(plain, /aria-pressed/);
  assert.match(plain, new RegExp(`d="${iconPathData("trash").replaceAll(".", "\\.")}"`));

  assert.match(renderToStaticMarkup(createElement(IconButton, { icon: "panelLeft", label: "左パネル", pressed: true })), /aria-pressed="true"/);
  assert.match(renderToStaticMarkup(createElement(IconButton, { icon: "panelLeft", label: "左パネル", pressed: false })), /aria-pressed="false"/);
  assert.match(renderToStaticMarkup(createElement(IconButton, { icon: "play", label: "再生", disabled: true, className: "extra" })),
    /^<button disabled="" type="button" class="icon-button extra"/);
});

test("ボタンは主と副を持ち、既定は副で type=button", () => {
  assert.equal(renderToStaticMarkup(createElement(Button, null, "キャンセル")), '<button type="button" class="button button-secondary">キャンセル</button>');
  assert.equal(renderToStaticMarkup(createElement(Button, { variant: "primary" }, "保存")), '<button type="button" class="button button-primary">保存</button>');
  assert.match(renderToStaticMarkup(createElement(Button, { variant: "primary", type: "submit" }, "送信")), /type="submit"/);
});
