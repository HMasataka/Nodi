import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Source for the editable .nodi mock: repeated UI is stored as real component instances.
let serial = 0;
const uid = () => `ui_${++serial}`;
const palette = ["ffffff", "f5f5f5", "e5e5e5", "d4d4d4", "a3a3a3", "737373", "525252", "404040", "171717", "000000"]
  .map((hex, i) => ({ id: `gray_${i}`, name: ["White", "Canvas", "Line", "Border", "Muted", "Secondary", "Body", "Strong", "Ink", "Black"][i], color: `#${hex}` }));
const color = (i) => ({ type: "palette", id: `gray_${i}` });
const spacing = [0, 4, 8, 12, 16, 20, 24, 32].map((value) => ({ id: `space_${value}`, name: `Space / ${value}`, value }));
const base = (name, width, height, x = 0, y = 0) => ({ id: uid(), name, x, y, width, height });
const text = (content, width, size = 12, ink = 6, weight = 400) => ({ ...base(content, width, Math.ceil((size + 4) / 4) * 4 + 4), type: "text", content,
  style: { fontSize: size, lineHeight: (Math.ceil((size + 4) / 4) * 4) / size, fontFamily: "system", fontWeight: weight, color: color(ink), textAlign: "left" } });
const rect = (w, h, ink = 2) => ({ ...base("Surface", w, h), type: "rectangle", style: { fill: color(ink) } });
function frame(name, w, h, children = [], fill = null, mode = "none", pad = 0, gap = 0) {
  return { ...base(name, w, h), type: "frame", style: { fill: fill === null ? null : color(fill) },
    layoutMode: mode, paddingRef: `space_${pad}`, gapRef: `space_${gap}`, alignItems: "center", children };
}
const at = (node, x, y) => ({ ...node, x, y });
const components = [];
function define(id, name, node) { components.push({ id, name, node }); return id; }
function instance(ref, x = 0, y = 0, overrides = {}) {
  const def = components.find((item) => item.id === ref);
  return { ...base(def.name, def.node.width, def.node.height, x, y), type: "instance", componentRef: ref, overrides };
}
function icon(kind, ink = 6) {
  const ref = `icon_${kind}_${ink}`;
  if (components.some((item) => item.id === ref)) return instance(ref);
  const paths = {
    chevron: [[0.2, 0.35], [0.5, 0.65], [0.8, 0.35]],
    back: [[0.65, 0.2], [0.35, 0.5], [0.65, 0.8]],
    plus: [[0.5, 0.15], [0.5, 0.85], null, [0.15, 0.5], [0.85, 0.5]],
    diamond: [[0.5, 0.1], [0.9, 0.5], [0.5, 0.9], [0.1, 0.5], [0.5, 0.1]],
    check: [[0.15, 0.5], [0.4, 0.75], [0.85, 0.25]],
    arrow: [[0.1, 0.5], [0.9, 0.5], null, [0.6, 0.2], [0.9, 0.5], [0.6, 0.8]],
  };
  let move = true;
  const node = { ...base(kind, 16, 16), type: "path", commands: paths[kind].flatMap((point) => {
    if (!point) { move = true; return []; }
    const command = { kind: move ? "move" : "line", x: point[0], y: point[1] }; move = false; return [command];
  }), style: { fill: null, stroke: { color: color(ink), width: 1.5 } } };
  define(ref, `Icon / ${kind}`, node);
  return instance(ref);
}
const buttonLabels = {};
for (const [key, w, fill, ink] of [["button", 124, 0, 7], ["primary", 124, 8, 0], ["wide", 260, 0, 7], ["widePrimary", 260, 8, 0]]) {
  const label = text("操作", w - 16, 12, ink, 600); label.style.textAlign = "center";
  buttonLabels[key] = label.id;
  define(key, `Control / ${key}`, frame(key, w, 36, [label], fill, "horizontal", 8, 0));
}
const button = (label, primary = false, wide = false) => {
  const key = wide ? primary ? "widePrimary" : "wide" : primary ? "primary" : "button";
  return instance(key, 0, 0, { [buttonLabels[key]]: { content: label } });
};
const inputLabel = text("値", 108, 12, 8);
define("input", "Control / Value", frame("Input", 124, 36, [inputLabel], 1, "horizontal", 8, 0));
const input = (label) => instance("input", 0, 0, { [inputLabel.id]: { content: label } });
const rowLabel = text("項目", 220, 12, 7);
define("row", "Control / Menu row", frame("Row", 260, 36, [rowLabel, icon("chevron")], null, "horizontal", 8, 8));
const row = (label) => instance("row", 0, 0, { [rowLabel.id]: { content: label } });
const tokenName = text("Card / Inset", 164, 12, 8);
const tokenValue = text("24 px", 48, 12, 5); tokenValue.style.textAlign = "right";
define("token", "Control / Reference field", frame("Reference", 260, 36, [icon("diamond"), tokenName, tokenValue], 1, "horizontal", 8, 8));
const token = (name, value) => instance("token", 0, 0, { [tokenName.id]: { content: name }, [tokenValue.id]: { content: value } });
const labelRow = text("Project card", 180, 13, 7);
define("layer", "Navigation / Layer row", frame("Layer", 220, 36, [icon("diamond"), labelRow], null, "horizontal", 8, 8));
const selectedRowLabel = text("Project card", 180, 13, 8, 600);
define("selectedLayer", "Navigation / Selected row", frame("Selected layer", 220, 36, [icon("diamond", 8), selectedRowLabel], 2, "horizontal", 8, 8));
const layer = (label, selected = false) => instance(selected ? "selectedLayer" : "layer", 0, 0,
  { [selected ? selectedRowLabel.id : labelRow.id]: { content: label } });
const cardTitle = text("Quiet objects", 252, 22, 8, 600);
define("projectCard", "Content / Project card", frame("Project card", 300, 340, [rect(252, 176, 3), cardTitle, text("Art direction / 2026", 252, 12, 5)], 0, "vertical", 24, 16));
const thumbTitle = text("Project card", 188, 13, 8, 600);
define("assetCard", "Assets / Component tile", frame("Project card", 220, 176, [rect(188, 104, 2), thumbTitle], 1, "vertical", 16, 8));
const tabs = (asset = false) => frame("Navigation tabs", 220, 40, [
  frame("レイヤー", 104, 32, [text("レイヤー", 88, 12, asset ? 5 : 8, asset ? 400 : 600)], asset ? null : 2, "horizontal", 8),
  frame("アセット", 104, 32, [text("アセット", 88, 12, asset ? 8 : 5, asset ? 600 : 400)], asset ? 2 : null, "horizontal", 8),
], 1, "horizontal", 4, 4);
define("layerTabs", "Navigation / Layers active", tabs(false));
define("assetTabs", "Navigation / Assets active", tabs(true));
define("header", "Shell / Document toolbar", frame("Toolbar", 1440, 64, [
  at(text("nodi", 72, 24, 8, 700), 20, 16), at(text("Studio — Website.nodi", 220, 14, 8, 600), 144, 20),
  at(text("保存済み", 80, 11, 5), 372, 22), at(button("プレビュー"), 1160, 14), at(button("保存", true), 1296, 14),
], 0));
define("footer", "Shell / Status bar", frame("Status", 1440, 32, [
  at(text("Studio / Desktop", 300, 11, 5), 20, 6), at(text("100%", 80, 11, 5), 1020, 6), at(text("アニメーション", 260, 11, 7), 1160, 6),
], 0));
define("tools", "Shell / Creation tools", frame("Tools", 480, 48, [
  at(button("選択", true), 8, 6), at(text("フレーム", 72, 12, 6), 148, 14), at(text("図形", 52, 12, 6), 236, 14),
  at(text("ペン", 44, 12, 6), 300, 14), at(text("文字", 44, 12, 6), 356, 14), at(icon("plus"), 444, 16),
], 0));
const section = (title, children) => {
  const heading = text(title, 260, 12, 8, 600);
  const height = heading.height + children.reduce((sum, node) => sum + node.height, 0) + children.length * 12;
  return frame(title, 260, height, [heading, ...children], null, "vertical", 0, 12);
};
const pair = (a, b) => frame("Pair", 260, 36, [a, b], null, "horizontal", 0, 12);
define("geometry", "Inspector / Geometry", section("位置・サイズ", [pair(input("X  32"), input("Y  104")), pair(input("W  300"), input("H  340")), pair(input("固定"), input("固定"))], 164));
define("geometryPlaced", "Inspector / Placed geometry", section("位置・サイズ", [pair(input("X  364"), input("Y  104")), pair(input("W  300"), input("H  340")), pair(input("固定"), input("固定"))], 164));
define("layout", "Inspector / Layout with reference", section("レイアウト", [pair(button("縦", true), button("横")),
  pair(text("間隔", 124, 12, 5), input("16 px")), text("余白", 260, 12, 5), token("Card / Inset", "24 px")], 204));
define("appearance", "Inspector / Appearance with reference", section("見た目", [token("Surface", "100%"), row("線"), row("効果")], 164));
function inspector(kind) {
  let controls;
  if (kind === "instance") controls = [text("インスタンス", 260, 11, 5), text("Project card", 260, 18, 8, 600), row("参照元 · Project card"), instance("geometryPlaced"),
    section("上書き", [text("Title", 260, 12, 5), token("Quiet objects", ""), button("元に戻す", false, true)], 148), row("インスタンスを切り離す")];
  else if (kind === "multi") controls = [text("3 要素を選択", 260, 18, 8, 600), section("整列", [pair(button("左揃え"), button("上揃え")), pair(button("横中央"), button("縦中央"))], 116),
    section("間隔・分配", [pair(input("横 24 px"), button("横に均等")), pair(input("縦 —"), button("縦に均等"))], 116)];
  else if (kind === "icon") controls = [text("2 要素を選択", 260, 18, 8, 600), section("整列", [pair(button("横中央"), button("縦中央"))], 68),
    section("文字行とアイコン", [text("中心差  0 px", 260, 12, 5), button("行の中心に揃える", true, true)], 104)];
  else if (kind === "motion") controls = [text("Cover", 260, 18, 8, 600), row("Fade in"), row("Hover lift"), button("アニメーションを追加", false, true),
    section("Fade in", [pair(input("読み込み"), input("800 ms")), pair(input("遅延 0 ms"), input("1 回")), row("不透明度")], 164)];
  else controls = [text("フレーム", 260, 11, 5), text("Project card", 260, 18, 8, 600), instance("geometry"), instance("layout"), instance("appearance"), row("コンポーネントを作成")];
  if (kind === "frame" || kind === "instance") {
    const heading = controls.splice(0, 2);
    controls.unshift(frame("Selection heading", 260, heading[0].height + heading[1].height + 8, heading, null, "vertical", 0, 8));
  }
  return frame("Inspector", 300, 864, controls, 0, "vertical", 20, 24);
}
for (const kind of ["frame", "instance", "multi", "icon", "motion"]) define(`inspector_${kind}`, `Inspector / ${kind}`, inspector(kind));
function navigation(kind) {
  const asset = kind !== "layers";
  let children = [instance(asset ? "assetTabs" : "layerTabs")];
  if (!asset) children.push(layer("Desktop"), layer("Selected work"), layer("Project card", true), layer("Cover"), layer("Title"));
  else if (kind === "assets") children.push(layer("コンポーネント", true), layer("色"), layer("余白・間隔"), instance("assetCard"), button("配置", true), button("新規作成"));
  else if (kind === "spacing") children.push(layer("コンポーネント"), layer("色"), layer("余白・間隔", true), layer("Card / Inset", true), layer("Stack / Gap"), button("余白値を追加"));
  else children.push(layer("コンポーネント"), layer("色", true), layer("余白・間隔"), layer("Surface", true), layer("Ink"), button("色を追加"), button("取り込み"));
  return frame("Navigation", 240, 864, children, 0, "vertical", 0, 8);
}
for (const kind of ["layers", "assets", "spacing", "colors"]) define(`nav_${kind}`, `Navigation / ${kind}`, navigation(kind));
define("nav_multi", "Navigation / Multiple selection", frame("Layers", 240, 864, [instance("layerTabs"), layer("Desktop"), layer("Selected work"), layer("Quiet objects", true), layer("Everyday forms", true), layer("Soft spaces", true)], 0, "vertical", 0, 8));
define("nav_icon", "Navigation / Text and icon selection", frame("Layers", 240, 864, [instance("layerTabs"), layer("Desktop"), layer("Project card"), layer("Arrow", true), layer("View project", true)], 0, "vertical", 0, 8));
define("nav_motion", "Navigation / Cover selected", frame("Layers", 240, 864, [instance("layerTabs"), layer("Desktop"), layer("Project card"), layer("Cover", true), layer("Title")], 0, "vertical", 0, 8));
const popup = (name, children) => {
  const height = children.reduce((sum, child) => sum + child.height, 0) + (children.length - 1) * 8 + 24;
  const node = frame(name, 284, height, children, 0, "vertical", 12, 8);
  node.style.stroke = { color: color(3), width: 1 };
  return node;
};
define("spacingPicker", "Overlay / Spacing picker", popup("余白", [text("余白", 260, 12, 8, 600), row("直接指定"), token("Card / Inset", "24 px"), token("Stack / Gap", "16 px"), row("共通値を編集"), row("24 px の直接値に戻す")], 272));
define("colorPicker", "Overlay / Color picker", popup("塗り", [text("塗り", 260, 12, 8, 600), row("直接指定"), token("Surface", "#fff"), token("Ink", "#171"), row("パレットで編集"), row("直接色に戻す")], 272));
define("colorEdit", "Overlay / Edit palette color", popup("Surface", [frame("Back", 260, 24, [icon("back"), text("色", 224, 12, 6)], null, "horizontal", 0, 8), text("Surface", 260, 18, 8, 600), rect(260, 72, 1), pair(input("#ffffff"), input("100%")), pair(button("キャンセル"), button("適用", true)), row("色を削除")], 312));
define("spacingEdit", "Overlay / Edit shared spacing", popup("Card / Inset", [frame("Back", 260, 24, [icon("back"), text("余白・間隔", 224, 12, 6)], null, "horizontal", 0, 8),
  text("Card / Inset", 260, 18, 8, 600), text("値", 260, 12, 5), token("Card / Inset", "24 px"), text("4 箇所で使用", 260, 11, 5),
  pair(button("キャンセル"), button("適用", true)), row("共通値を削除")], 300));
define("deleteSpacing", "Overlay / Delete shared spacing", popup("共通値を削除", [text("Card / Inset を削除", 260, 16, 8, 600),
  text("4 箇所を 24 px の直接値に変換", 260, 12, 5), pair(button("キャンセル"), button("削除", true))], 132));
define("previewHeader", "Shell / Preview toolbar", frame("Preview", 1440, 64, [at(button("編集に戻る"), 20, 14), at(text("Studio — Website", 260, 14, 8, 600), 168, 20),
  at(input("検証幅 1440"), 984, 14), at(button("全体表示", true), 1120, 14), at(button("実寸"), 1256, 14)], 0));
function page(mode = "frame") {
  const items = [at(text("Selected work", 600, 30, 8, 600), 32, 24)];
  const positions = mode === "multi" ? [32, 276, 520] : [32, 364];
  positions.forEach((x, i) => {
    const card = instance("projectCard", x, 104, { [cardTitle.id]: { content: ["Quiet objects", "Everyday forms", "Soft spaces"][i] } });
    if (mode === "multi") { card.width = 220; card.height = 340; }
    items.push(card);
  });
  return frame("Desktop / Selected work", 780, 540, items, 0);
}
// Multi-selection uses a dedicated compact card definition instead of stretching a fixed-size component.
define("compactCard", "Content / Compact project card", frame("Compact card", 220, 340, [rect(172, 176, 3), text("Project", 172, 18, 8, 600), text("2026", 172, 12, 5)], 0, "vertical", 24, 16));
define("canvasPage", "Canvas / Selected work", page());
const multiPage = page("multi");
multiPage.children = multiPage.children.map((node) => node.type === "instance" ? { ...node, componentRef: "compactCard", overrides: {} } : node);
define("multiPage", "Canvas / Three cards", multiPage);
const outline = (w, h) => ({ ...rect(w, h), name: "Selection outline", style: { fill: null, stroke: { color: color(8), width: 1.5 } } });
function screen(id, name, column, line, nav = "layers", inspect = "frame", overlay) {
  const children = [instance("header"), instance(`nav_${nav}`, 0, 64), instance(`inspector_${inspect}`, 1140, 64), instance("footer", 0, 928),
    at(text("Desktop / Selected work / Project card", 760, 12, 5), 280, 88), instance(inspect === "multi" ? "multiPage" : "canvasPage", 280, 176), instance("tools", 450, 840)];
  if (inspect === "multi") {
    for (const x of [312, 556, 800]) children.push(at(outline(220, 340), x, 280));
    for (const x of [532, 776]) children.push(at(rect(24, 1, 8), x, 640), at(text("24", 24, 11, 6), x, 652));
  } else children.push(at(outline(300, 340), 312, 280));
  if (overlay) children.push(instance(overlay.ref, overlay.x, overlay.y));
  return { ...frame(name, 1440, 960, children, 1), id, x: column * 1520 + 80, y: line * 1040 + 80 };
}
const screens = [
  screen("screen_editor", "01 / エディタ — フレーム選択", 0, 0),
  screen("screen_spacing_picker", "02 / 余白フィールドを開く", 1, 0, "layers", "frame", { ref: "spacingPicker", x: 1136, y: 545 }),
  screen("screen_spacing_edit", "03 / 共通値を編集", 2, 0, "spacing", "frame", { ref: "spacingEdit", x: 248, y: 208 }),
  screen("screen_spacing_delete", "04 / 共通値の削除確認", 3, 0, "spacing", "frame", { ref: "deleteSpacing", x: 248, y: 208 }),
  screen("screen_assets", "05 / アセット — コンポーネントを選択", 0, 1, "assets"),
  screen("screen_instance", "06 / 配置後 — インスタンス選択", 1, 1, "assets", "instance"),
  screen("screen_colors", "07 / 塗りフィールドを開く", 2, 1, "layers", "frame", { ref: "colorPicker", x: 1136, y: 637 }),
  screen("screen_palette", "08 / パレットで編集", 3, 1, "colors", "frame", { ref: "colorEdit", x: 248, y: 208 }),
  screen("screen_multi", "09 / 複数選択 — 間隔を指定", 0, 2, "multi", "multi"),
  screen("screen_text_icon", "10 / 文字とアイコン — 中心揃え", 1, 2, "icon", "icon"),
];
const beforePlacement = page();
beforePlacement.children = beforePlacement.children.filter((node, i) => i < 2);
define("beforePlacement", "Canvas / Before placement", beforePlacement);
const afterPlacement = page();
afterPlacement.children[2].overrides = { [cardTitle.id]: { content: "Quiet objects" } };
define("afterPlacement", "Canvas / After placement", afterPlacement);
for (const [screenId, pageRef, selectedX] of [["screen_assets", "beforePlacement", 312], ["screen_instance", "afterPlacement", 644]]) {
  const target = screens.find(({ id }) => id === screenId);
  target.children = target.children.map((node) => node.componentRef === "canvasPage" ? instance(pageRef, 280, 176)
    : node.name === "Selection outline" ? at(outline(300, 340), selectedX, 280) : node);
}
const iconScreen = screens.find((item) => item.id === "screen_text_icon");
iconScreen.children = iconScreen.children.filter((item) => item.name !== "Selection outline");
iconScreen.children.push(at(frame("View project / 2要素選択", 252, 40, [icon("arrow", 8), text("View project", 212, 12, 8)], 0, "horizontal", 8, 8), 336, 638),
  at(outline(252, 40), 336, 638));
const preview = frame("11 / プレビュー — 編集に戻る", 1440, 960, [instance("previewHeader"), instance("canvasPage", 330, 184)], 1);
preview.id = "screen_preview"; preview.x = 3120; preview.y = 2160;
screens.push(preview);

define("timeline", "Animation / Timeline", frame("Timeline", 900, 208, [
  at(button("再生", true), 20, 16), at(input("400 ms"), 156, 16), at(button("閉じる"), 756, 16),
  at(text("Cover / Fade in", 180, 13, 8, 600), 20, 72), at(text("0 ms", 72, 11, 5), 224, 72), at(text("800 ms", 72, 11, 5), 788, 72),
  at(text("不透明度", 180, 12, 6), 20, 112), at(rect(604, 2, 3), 224, 124), at(icon("diamond", 8), 224, 117), at(icon("diamond", 8), 812, 117),
  at(input("時刻 400"), 20, 156), at(input("値 50%"), 156, 156), at(button("ease-out"), 292, 156),
], 0));
const motion = screen("screen_motion", "12 / アニメーション — 同じ要素のタイムライン", 3, 2, "motion", "motion");
motion.children = motion.children.filter((node) => node.componentRef !== "tools" && node.name !== "Selection outline");
motion.children.push(at(outline(252, 176), 336, 304));
motion.children.push(instance("timeline", 240, 720));
screens.push(motion);

// Pack navigation into a padded tab strip and a continuous 36px layer list.
for (const definition of components.filter(({ id }) => id.startsWith("nav_"))) {
  const [tab, ...items] = definition.node.children;
  const isAssets = ["nav_assets", "nav_spacing", "nav_colors"].includes(definition.id);
  const list = frame("Navigation items", 220, items.reduce((sum, item) => sum + item.height, 0) + (isAssets ? (items.length - 1) * 8 : 0), items, null, "vertical", 0, isAssets ? 8 : 0);
  definition.node.layoutMode = "none";
  definition.node.children = [at(tab, 10, 20), at(list, 10, 76)];
}

// Auto-sized content must not leave an arbitrary strip below the last child.
for (const ref of ["projectCard", "compactCard", "assetCard"]) {
  const node = components.find(({ id }) => id === ref).node;
  const contentHeight = node.children.reduce((sum, child) => sum + child.height, 0);
  const used = contentHeight + Number(node.gapRef.slice(6)) * (node.children.length - 1);
  // Keep the card's outer geometry stable; distribute the remaining space inside
  // the media region so the bottom inset stays identical to the top inset.
  node.children[0].height += node.height - Number(node.paddingRef.slice(6)) * 2 - used;
}

// Compute input anchors from their actual auto-layout stack rather than fixed y values.
function referenceFieldY(sectionRef) {
  const inspectorNode = components.find(({ id }) => id === "inspector_frame").node;
  let y = 64 + 20;
  for (const child of inspectorNode.children) {
    if (child.componentRef === sectionRef) {
      const sectionNode = components.find(({ id }) => id === sectionRef).node;
      for (const field of sectionNode.children) {
        if (field.componentRef === "token") return y;
        y += field.height + 12;
      }
    }
    y += child.height + 24;
  }
  throw new Error(`Missing reference field: ${sectionRef}`);
}
for (const [id, sectionRef] of [["screen_spacing_picker", "layout"], ["screen_colors", "appearance"]]) {
  const target = screens.find((item) => item.id === id);
  const overlay = target.children.pop();
  const y = referenceFieldY(sectionRef);
  overlay.y = y + 36 + 8;
  if (overlay.y + overlay.height > 908) {
    overlay.x = 1160 - 8 - overlay.width;
    overlay.y = Math.min(y, 908 - overlay.height);
  }
  target.children.push(at(outline(260, 36), 1160, y), overlay);
}

// Cover selection follows the component's media size after its inset correction.
const media = components.find(({ id }) => id === "projectCard").node.children[0];
const coverOutline = motion.children.find(({ name }) => name === "Selection outline");
coverOutline.height = media.height;

export const designDocument = { version: 1, children: screens, palette, spacing, components };
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL("./nodi.nodi", import.meta.url), JSON.stringify(designDocument, null, 2) + "\n");
}
