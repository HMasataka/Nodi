import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { ColorField } from "../src/pages/editor/components/molecules/ColorField";
import { paletteColor } from "./support/factories.ts";
import { resolveColor } from "../src/document/colorRef.ts";
import { ColorResolverContext, PaletteContext } from "../src/pages/editor/colorContext.ts";

const palette = [
  paletteColor({ id: "pc1", name: "主色", color: "#123456" }),
  paletteColor({ id: "pc2", name: "背景", color: "#ffffff" }),
];

function wrap(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <ColorResolverContext.Provider value={(color) => resolveColor(color, palette)}>
      <PaletteContext.Provider value={palette}>{node}</PaletteContext.Provider>
    </ColorResolverContext.Provider>,
  );
}

test("ColorField はパレット参照を解決して表示し、直接指定と参照を選べる", () => {
  const markup = wrap(<ColorField label="塗り" value={{ type: "palette", id: "pc1" }} fallback="#ffffff" onChange={() => {}} />);
  assert.match(markup, /type="color" value="#123456"/);
  assert.match(markup, /主色/);
  assert.match(markup, /直接指定/);
  assert.match(markup, /背景/);
});
