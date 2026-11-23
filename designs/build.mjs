import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let serial = 0;
const uid = () => `ui_${++serial}`;

// 配色は Palette 18 の紫（主役）と、Swatches の Grey（色みのない灰）を組み合わせる。出典は ../design/color-palettes.md。
// 段は 900→050 の順。部品は灰色の段を 0（白）〜9（最も暗い）の番号で指定し、番号から段へ置き換える。
const steps = ["900", "800", "700", "600", "500", "400", "300", "200", "100", "050"];
const greyScale = ["#222222", "#3B3B3B", "#515151", "#626262", "#7E7E7E", "#9E9E9E", "#B1B1B1", "#CFCFCF", "#E1E1E1", "#F7F7F7"];
const purpleScale = ["#240754", "#34126F", "#421987", "#51279B", "#653CAD", "#724BB7", "#8662C7", "#A081D9", "#CFBCF2", "#EAE2F8"];
const grayNames = ["White", "Canvas", "Line", "Border", "Muted", "Secondary", "Body", "Strong", "Ink", "Black"];
const palette = [
  { id: "white", name: "White", color: "#ffffff" },
  ...greyScale.map((color, index) => ({ id: `neutral_${steps[index]}`, name: `Grey / ${steps[index]}`, color: color.toLowerCase() })),
  ...purpleScale.map((color, index) => ({ id: `primary_${steps[index]}`, name: `Purple / ${steps[index]}`, color: color.toLowerCase() })),
];
const spacing = [0, 4, 8, 12, 16, 20, 24, 32].map((value) => ({ id: `space_${value}`, name: `Space / ${value}`, value }));
const neutralStepOfTone = [null, "050", "100", "200", "400", "600", "700", "800", "900", "900"];
const primary = (step) => ({ type: "palette", id: `primary_${step}` });
const gray = (tone) => tone === "primary" ? primary("700") : { type: "palette", id: neutralStepOfTone[tone] ? `neutral_${neutralStepOfTone[tone]}` : "white" };
const corners = (radius) => ({ topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius });

function text(content, width, { size = 12, tone = 7, weight = 400, align = "left" } = {}) {
  const lineHeight = Math.ceil((size + 4) / 4) * 4;
  return { id: uid(), name: content, x: 0, y: 0, width, height: lineHeight + 4, type: "text", content,
    style: { fontSize: size, lineHeight: lineHeight / size, fontFamily: "system", fontWeight: weight, color: gray(tone), textAlign: align } };
}

function rect(name, width, height, { fill = 2, stroke = null, radius = 0 } = {}) {
  const style = { fill: fill === null ? null : gray(fill) };
  if (stroke !== null) style.stroke = { color: gray(stroke), width: 1 };
  if (radius) style.cornerRadii = corners(radius);
  return { id: uid(), name, x: 0, y: 0, width, height, type: "rectangle", style };
}

function frame(name, width, height, children = [], options = {}) {
  const { fill = null, layout = "none", pad = 0, gap = 0, align = "start", justify = "start", radius = 0, stroke = null, border = [] } = options;
  const style = { fill: fill === null ? null : gray(fill) };
  if (stroke !== null) style.stroke = { color: gray(stroke), width: 1 };
  if (radius) style.cornerRadii = corners(radius);
  if (border.length) style.border = Object.fromEntries(border.map((side) => [side, { color: gray(2), width: 1 }]));
  return { id: uid(), name, x: 0, y: 0, width, height, type: "frame", style, layoutMode: layout,
    paddingRef: `space_${pad}`, gapRef: `space_${gap}`, alignItems: align, justifyContent: justify, children };
}

function column(name, width, children, options = {}) {
  const { pad = 0, gap = 0 } = options;
  const height = children.reduce((sum, child) => sum + child.height, 0) + gap * Math.max(children.length - 1, 0) + pad * 2;
  return frame(name, width, height, children, { ...options, layout: "vertical" });
}

function row(name, width, children, options = {}) {
  const height = options.height ?? Math.max(...children.map((child) => child.height)) + (options.pad ?? 0) * 2;
  return frame(name, width, height, children, { align: "center", ...options, layout: "horizontal" });
}

const at = (node, x, y) => ({ ...node, x, y });
const box = (name, x, y, width, height, options) => at(rect(name, width, height, options), x, y);
const divider = (width, height = 1) => rect("Divider", width, height, { fill: 2 });

const components = [];
function define(id, name, build) {
  if (!components.some((item) => item.id === id)) components.push({ id, name, node: build() });
  return id;
}
function use(ref, overrides = {}) {
  const definition = components.find((item) => item.id === ref);
  return { id: uid(), name: definition.name, x: 0, y: 0, width: definition.node.width, height: definition.node.height,
    type: "instance", componentRef: ref, overrides };
}
const slot = (ref, index) => components.find((item) => item.id === ref).node.children[index].id;

const octagon = Array.from({ length: 8 }, (_, index) => {
  const angle = (Math.PI / 4) * index + Math.PI / 8;
  return [0.5 + Math.cos(angle) * 0.36, 0.5 + Math.sin(angle) * 0.36];
});
const iconPaths = {
  select: [[0.28, 0.12], [0.28, 0.82], [0.45, 0.65], [0.57, 0.9], [0.68, 0.85], [0.56, 0.6], [0.8, 0.6], "close"],
  frame: [[0.35, 0.1], [0.35, 0.9], null, [0.65, 0.1], [0.65, 0.9], null, [0.1, 0.35], [0.9, 0.35], null, [0.1, 0.65], [0.9, 0.65]],
  rectangle: [[0.15, 0.2], [0.85, 0.2], [0.85, 0.8], [0.15, 0.8], "close"],
  ellipse: [...octagon, "close"],
  pen: [[0.5, 0.1], [0.82, 0.5], [0.62, 0.9], [0.38, 0.9], [0.18, 0.5], "close", null, [0.5, 0.1], [0.5, 0.55]],
  text: [[0.2, 0.18], [0.8, 0.18], null, [0.5, 0.18], [0.5, 0.85]],
  image: [[0.12, 0.18], [0.88, 0.18], [0.88, 0.82], [0.12, 0.82], "close", null, [0.12, 0.72], [0.4, 0.46], [0.6, 0.66], [0.72, 0.54], [0.88, 0.7]],
  panelLeft: [[0.12, 0.2], [0.88, 0.2], [0.88, 0.8], [0.12, 0.8], "close", null, [0.4, 0.2], [0.4, 0.8]],
  panelRight: [[0.12, 0.2], [0.88, 0.2], [0.88, 0.8], [0.12, 0.8], "close", null, [0.6, 0.2], [0.6, 0.8]],
  preview: [[0.08, 0.5], [0.3, 0.28], [0.5, 0.22], [0.7, 0.28], [0.92, 0.5], [0.7, 0.72], [0.5, 0.78], [0.3, 0.72], "close", null,
    ...octagon.map(([x, y]) => [0.5 + (x - 0.5) / 3, 0.5 + (y - 0.5) / 3]), "close"],
  timeline: [[0.12, 0.25], [0.6, 0.25], null, [0.3, 0.5], [0.88, 0.5], null, [0.2, 0.75], [0.72, 0.75]],
  play: [[0.3, 0.2], [0.8, 0.5], [0.3, 0.8], "close"],
  trash: [[0.2, 0.28], [0.8, 0.28], null, [0.4, 0.28], [0.4, 0.15], [0.6, 0.15], [0.6, 0.28], null, [0.28, 0.28], [0.32, 0.85], [0.68, 0.85], [0.72, 0.28]],
  keyframeAdd: [[0.35, 0.15], [0.6, 0.4], [0.35, 0.65], [0.1, 0.4], "close", null, [0.78, 0.55], [0.78, 0.95], null, [0.58, 0.75], [0.98, 0.75]],
  more: [[0.18, 0.5], [0.26, 0.5], null, [0.46, 0.5], [0.54, 0.5], null, [0.74, 0.5], [0.82, 0.5]],
  chevronRight: [[0.4, 0.28], [0.62, 0.5], [0.4, 0.72]],
  chevronLeft: [[0.6, 0.28], [0.38, 0.5], [0.6, 0.72]],
  arrowRight: [[0.15, 0.5], [0.85, 0.5], null, [0.55, 0.22], [0.85, 0.5], [0.55, 0.78]],
  reset: [[0.3, 0.22], [0.12, 0.4], [0.3, 0.58], null, [0.12, 0.4], [0.62, 0.4], [0.85, 0.62], [0.62, 0.84], [0.35, 0.84]],
  corners: [[0.15, 0.4], [0.15, 0.15], [0.4, 0.15], null, [0.6, 0.15], [0.85, 0.15], [0.85, 0.4], null, [0.85, 0.6], [0.85, 0.85], [0.6, 0.85], null, [0.4, 0.85], [0.15, 0.85], [0.15, 0.6]],
  check: [[0.22, 0.52], [0.42, 0.72], [0.78, 0.3]],
  bold: [[0.3, 0.15], [0.3, 0.85], [0.6, 0.85], [0.74, 0.72], [0.74, 0.62], [0.6, 0.5], [0.3, 0.5], null, [0.3, 0.15], [0.56, 0.15], [0.68, 0.25], [0.68, 0.4], [0.56, 0.5]],
  underline: [[0.28, 0.15], [0.28, 0.5], [0.4, 0.66], [0.6, 0.66], [0.72, 0.5], [0.72, 0.15], null, [0.2, 0.86], [0.8, 0.86]],
  code: [[0.35, 0.25], [0.12, 0.5], [0.35, 0.75], null, [0.65, 0.25], [0.88, 0.5], [0.65, 0.75]],
  close: [[0.25, 0.25], [0.75, 0.75], null, [0.75, 0.25], [0.25, 0.75]],
  minus: [[0.2, 0.5], [0.8, 0.5]],
  plus: [[0.5, 0.2], [0.5, 0.8], null, [0.2, 0.5], [0.8, 0.5]],
  chevronDown: [[0.28, 0.4], [0.5, 0.62], [0.72, 0.4]],
  component: [[0.5, 0.1], [0.9, 0.5], [0.5, 0.9], [0.1, 0.5], "close", null, [0.5, 0.3], [0.7, 0.5], [0.5, 0.7], [0.3, 0.5], "close"],
  alert: [...octagon, "close", null, [0.5, 0.3], [0.5, 0.56], null, [0.5, 0.68], [0.5, 0.72]],
  import: [[0.5, 0.12], [0.5, 0.62], null, [0.3, 0.42], [0.5, 0.62], [0.7, 0.42], null, [0.15, 0.62], [0.15, 0.85], [0.85, 0.85], [0.85, 0.62]],
};
function icon(kind, tone = 6) {
  return use(define(`icon_${kind}_${tone}`, `Icon / ${kind}`, () => iconPathNode(kind, tone)));
}
function iconPathNode(kind, tone) {
  {
    let move = true;
    const commands = iconPaths[kind].flatMap((point) => {
      if (point === null) { move = true; return []; }
      if (point === "close") return [{ kind: "close" }];
      const command = { kind: move ? "move" : "line", x: point[0], y: point[1] };
      move = false;
      return [command];
    });
    return { id: uid(), name: kind, x: 0, y: 0, width: 16, height: 16, type: "path", commands, style: { fill: null, stroke: { color: gray(tone), width: 1.5 } } };
  }
}

function iconButton(kind, active = false) {
  return use(define(`iconButton_${kind}_${active}`, `Control / Icon button / ${kind}`, () =>
    row(kind, 32, [icon(kind, active ? "primary" : 6)], { height: 32, pad: 8, justify: "center", fill: active ? 2 : null, radius: 6 })));
}

function field(label, value, { width = 120, labelWidth = 16 } = {}) {
  const ref = define(`field_${width}_${labelWidth}`, "Control / Field", () =>
    row("Field", width, [text("X", labelWidth, { size: 11, tone: 5 }), text("0", width - 20 - labelWidth, { tone: 8 })],
      { height: 28, pad: 8, gap: 4, fill: 1, radius: 4 }));
  return use(ref, { [slot(ref, 0)]: { content: label }, [slot(ref, 1)]: { content: value } });
}

function colorField(name, opacity, width = 248) {
  const ref = define(`colorField_${width}`, "Control / Color field", () =>
    row("Color field", width, [rect("Swatch", 16, 16, { fill: 0, stroke: 3, radius: 4 }), text("White", width - 92, { tone: 8 }), text("100%", 40, { tone: 5, align: "right" })],
      { height: 28, pad: 8, gap: 8, fill: 1, radius: 4 }));
  return use(ref, { [slot(ref, 1)]: { content: name }, [slot(ref, 2)]: { content: opacity } });
}

function segmented(labels, active, width) {
  return use(define(`segmented_${labels.join("_")}_${active}_${width}`, `Control / Segmented / ${labels.join(" ")}`, () => {
    const itemWidth = (width - 8 - 4 * (labels.length - 1)) / labels.length;
    return row("Segmented", width, labels.map((label, index) =>
      row(label, itemWidth, [text(label, itemWidth - 8, { tone: index === active ? 8 : 5, weight: index === active ? 600 : 400, align: "center" })],
        { height: 24, justify: "center", fill: index === active ? 0 : null, radius: 6 })), { height: 32, pad: 4, gap: 4, fill: 1, radius: 8 });
  }));
}

function sectionHeader(title, action = "add", width = 248) {
  const ref = define(`sectionHeader_${action}_${width}`, "Inspector / Section header", () => {
    const label = text("見出し", action === "none" ? width : width - 24, { size: 11, tone: 8, weight: 600 });
    return row("Section header", width, action === "none" ? [label] : [label, icon(action === "add" ? "plus" : "minus", 5)], { height: 24, justify: "space-between" });
  });
  return use(ref, { [slot(ref, 0)]: { content: title } });
}

function layerRow(name, kind, depth, selected, width) {
  const ref = define(`layer_${width}_${kind}_${depth}_${selected}`, `Navigation / Layer row${selected ? " / Selected" : ""}`, () => {
    const indent = depth * 16;
    const children = [icon(kind, selected ? "primary" : 5), text("Layer", width - 16 - 16 - 8 - (indent ? indent + 8 : 0), { tone: selected ? 8 : 7, weight: selected ? 600 : 400 })];
    if (indent) children.unshift(frame("Indent", indent, 1));
    return row("Layer row", width, children, { height: 28, pad: 8, gap: 8, fill: selected ? 2 : null, radius: 6 });
  });
  return use(ref, { [slot(ref, depth ? 2 : 1)]: { content: name } });
}

const layerTree = [
  ["Desktop / Selected work", "frame", 0], ["Title", "text", 1], ["Project card", "frame", 1, true],
  ["Cover", "rectangle", 2], ["Title", "text", 2], ["Meta", "text", 2],
  ["Project card", "frame", 1], ["About", "frame", 0], ["Contact", "frame", 0],
];
const layerList = (width, count = layerTree.length) =>
  column("Layers", width, layerTree.slice(0, count).map(([name, kind, depth, selected = false]) => layerRow(name, kind, depth, selected, width)));

const toolKinds = ["select", "frame", "rectangle", "ellipse", "pen", "text", "image"];
define("tools", "Shell / Tools", () => row("Tools", 248, toolKinds.map((kind, index) => iconButton(kind, index === 0)), { gap: 4 }));

function animationRow(name, trigger) {
  const ref = define("animationRow", "Inspector / Animation row", () =>
    row("Animation row", 248, [text("Animation", 160, { tone: 8 }), text("トリガー", 64, { size: 11, tone: 5, align: "right" })], { height: 28, pad: 8, gap: 8, fill: 1, radius: 4 }));
  return use(ref, { [slot(ref, 0)]: { content: name }, [slot(ref, 1)]: { content: trigger } });
}

const pair = (first, second) => row("Pair", 248, [first, second], { gap: 8 });
const sectionWith = (action) => (title, controls = []) => column(title, 248, [sectionHeader(title, action), ...controls], { gap: 8 });
// 常にある節は記号なし、一つだけ持てる節は未設定で「＋」・設定済みで「−」、複数持てる節は常に「＋」。
const fixed = sectionWith("none");
const optional = (title, controls = []) => sectionWith(controls.length ? "remove" : "add")(title, controls);
const multiple = sectionWith("add");
const caption = (content, width = 248) => text(content, width, { size: 11, tone: 5 });

function selectField(label, value, { width = 120, labelWidth = 16 } = {}) {
  const ref = define(`selectField_${width}_${labelWidth}`, "Control / Select field", () =>
    row("Select field", width, [text("X", labelWidth, { size: 11, tone: 5 }), text("0", width - 16 - labelWidth - 16 - 8, { tone: 8 }), icon("chevronDown", 5)],
      { height: 28, pad: 8, gap: 4, fill: 1, radius: 4 }));
  return use(ref, { [slot(ref, 0)]: { content: label }, [slot(ref, 1)]: { content: value } });
}

function linkRow(label, kind) {
  const ref = define(`linkRow_${kind}`, "Control / Link row", () =>
    row("Link row", 248, [text("Link", 208, { tone: 8 }), icon(kind, 6)], { height: 28, pad: 8, gap: 8, fill: 1, radius: 4 }));
  return use(ref, { [slot(ref, 0)]: { content: label } });
}

function overrideRow(name, value) {
  const ref = define("overrideRow", "Inspector / Override row", () =>
    row("Override row", 248, [text("Name", 64, { size: 11, tone: 5 }), text("Value", 136, { tone: 8 }), icon("reset", 5)], { height: 28, pad: 8, gap: 8, fill: 1, radius: 4 }));
  return use(ref, { [slot(ref, 0)]: { content: name }, [slot(ref, 1)]: { content: value } });
}

function checkboxRow(label, checked) {
  const ref = define(`checkboxRow_${checked}`, "Control / Checkbox", () => {
    const box = checked ? row("Box", 16, [icon("check", 0)], { height: 16, fill: 8, radius: 4 }) : frame("Box", 16, 16, [], { fill: 0, stroke: 4, radius: 4 });
    return row("Checkbox", 248, [box, text("Label", 224, { tone: 7 })], { height: 28, gap: 8 });
  });
  return use(ref, { [slot(ref, 1)]: { content: label } });
}

function cornerField(value) {
  return row("Corner radius", 248, [field("角丸", value, { width: 208, labelWidth: 28 }), iconButton("corners")], { gap: 8 });
}

function inspectorHeading(kind, name) {
  return row("Selection", 248, [column("Name", 208, [caption(kind, 208), text(name, 208, { size: 14, tone: 8, weight: 600 })]), iconButton("more")], { justify: "space-between" });
}

function geometry([x, y, width, height], [widthMode, heightMode]) {
  return fixed("位置とサイズ", [
    pair(field("X", x), field("Y", y)), pair(field("W", width), field("H", height)),
    pair(selectField("幅", widthMode, { labelWidth: 28 }), selectField("高さ", heightMode, { labelWidth: 28 })),
    pair(field("回転", "0°", { labelWidth: 28 }), field("不透明度", "100%", { labelWidth: 48 })),
  ]);
}

// 全種類で見出し、位置とサイズ、種類ごとの節、見た目の節、効果、アニメーションの順を守る。
function inspector(kind, name, box, sizeModes, specific, appearance, effects = [], animations = []) {
  const blocks = [inspectorHeading(kind, name), geometry(box, sizeModes), ...specific, ...appearance, multiple("効果", effects), multiple("アニメーション", animations)];
  return column("Inspector", 248, blocks.flatMap((block, index) => index === 0 ? [block] : [divider(248), block]), { gap: 12 });
}

const inspectorKinds = {
  frame: () => inspector("フレーム", "Project card", ["364", "104", "300", "308"], ["固定", "内容"], [
    fixed("自動レイアウト", [segmented(["なし", "縦", "横"], 1, 248), pair(field("間隔", "16", { labelWidth: 28 }), field("余白", "24", { labelWidth: 28 })),
      segmented(["始点", "中央", "終点"], 0, 248), checkboxRow("はみ出しを隠す", true)]),
  ], [optional("塗り", [colorField("Canvas", "100%")]), optional("線"), fixed("角丸", [cornerField("0")])], [],
  [animationRow("Fade in", "読み込み"), animationRow("Hover lift", "ホバー")]),
  text: () => inspector("テキスト", "Title", ["24", "232", "252", "32"], ["伸縮", "内容"], [
    fixed("テキスト", [selectField("書体", "System", { width: 248, labelWidth: 28 }), pair(field("サイズ", "22", { labelWidth: 40 }), selectField("太さ", "600", { labelWidth: 28 })),
      pair(field("行高", "1.3", { labelWidth: 28 }), field("字間", "0", { labelWidth: 28 })), segmented(["左", "中央", "右"], 0, 248),
      row("Marks", 248, [text("選択範囲", 136, { size: 11, tone: 5 }), iconButton("bold"), iconButton("underline"), iconButton("code")], { gap: 4 })]),
  ], [optional("文字色", [colorField("Ink", "100%")])]),
  image: () => inspector("画像", "Cover photo", ["24", "24", "252", "176"], ["伸縮", "固定"], [
    fixed("画像", [segmented(["切り抜き", "収める", "伸ばす"], 0, 248), pair(field("焦点 X", "50%", { labelWidth: 40 }), field("焦点 Y", "50%", { labelWidth: 40 })),
      linkRow("色調整", "chevronRight")]),
  ], [fixed("角丸", [cornerField("8")])], [caption("影"), colorField("Black", "16%"), pair(field("X", "0"), field("Y", "8")), field("ぼかし", "24", { width: 248, labelWidth: 40 }),
    caption("全体ぼかし"), field("ぼかし", "0 px", { width: 248, labelWidth: 40 })]),
  rectangle: () => inspector("矩形", "Cover", ["24", "24", "252", "176"], ["伸縮", "固定"], [
    fixed("マスク", [checkboxRow("マスクとして使う", false)]),
  ], [optional("塗り", [colorField("Border", "100%")]),
    optional("線", [colorField("Ink", "100%"), field("太さ", "1", { width: 248, labelWidth: 28 }), segmented(["全辺", "上", "右", "下", "左"], 0, 248)]),
    fixed("角丸", [cornerField("0")])]),
  path: () => inspector("パス", "Arrow", ["228", "12", "16", "16"], ["固定", "固定"], [
    fixed("パス", [linkRow("点を編集", "pen"), segmented(["非ゼロ", "偶奇"], 0, 248)]),
  ], [optional("塗り"), optional("線", [colorField("Ink", "100%"), field("太さ", "1.5", { width: 248, labelWidth: 28 })])]),
  instance: () => inspector("インスタンス", "Project card", ["364", "104", "300", "308"], ["固定", "内容"], [
    fixed("コンポーネント", [linkRow("Project card", "arrowRight")]),
    fixed("上書き", [overrideRow("Title", "Everyday forms"), overrideRow("Meta", "Art direction / 2026")]),
  ], []),
};
const inspectorTitles = { frame: "フレーム", text: "テキスト", image: "画像", rectangle: "矩形と楕円", path: "パス", instance: "インスタンス" };
for (const [kind, build] of Object.entries(inspectorKinds)) define(`inspector_${kind}`, `Inspector / ${inspectorTitles[kind]}`, build);

function menuRow(label, tone = 7) {
  const ref = define(`menuRow_${tone}`, "Control / Menu row", () => row("Menu row", 184, [text("Item", 168, { tone })], { height: 28, pad: 8, radius: 6 }));
  return use(ref, { [slot(ref, 0)]: { content: label } });
}
define("moreMenu", "Inspector / More menu", () => column("More menu", 200, [
  menuRow("名前を変更"), menuRow("複製"), menuRow("削除"), divider(184),
  menuRow("最前面へ"), menuRow("最背面へ"), divider(184),
  menuRow("コンポーネントを作成"), menuRow("PNG に書き出す"), divider(184),
  menuRow("ID をコピー"), row("Node ID", 184, [text("node_8f3a2c", 168, { size: 11, tone: 5 })], { height: 24, pad: 8 }),
], { pad: 8, gap: 4, fill: 0, stroke: 2, radius: 12 }));

// カードの中身は幅いっぱいに伸ばし、プレビューで幅が変わってもカードに沿うようにする。
const fill = (node) => ({ ...node, widthConstraint: { mode: "fill" } });
define("projectCard", "Content / Project card", () => column("Project card", 300, [
  rect("Cover", 252, 176, { fill: 3 }), text("Quiet objects", 252, { size: 22, tone: 8, weight: 600 }), text("Art direction / 2026", 252, { tone: 5 }),
].map(fill), { pad: 24, gap: 16, fill: 1 }));
define("artboard", "Canvas / Selected work", () => frame("Desktop / Selected work", 780, 460, [
  at(text("Selected work", 600, { size: 30, tone: 8, weight: 600 }), 32, 24),
  at(use("projectCard"), 32, 104),
  at(use("projectCard", { [slot("projectCard", 1)]: { content: "Everyday forms" } }), 364, 104),
], { fill: 0 }));

// キャンバスの上の表示は、線を濃いグレーの1px、つまみを白地の8px角、寸法を濃い地の札にそろえる。
const selectionHandle = (centerX, centerY) => at(rect("Handle", 8, 8, { fill: 0, stroke: 8 }), centerX - 4, centerY - 4);
function sizeChip(label) {
  const ref = define("sizeChip", "Canvas / Size label", () =>
    row("Size label", 72, [text("0 × 0", 64, { size: 11, tone: 0, align: "center" })], { height: 20, pad: 4, justify: "center", fill: 8, radius: 4 }));
  return use(ref, { [slot(ref, 0)]: { content: label } });
}
const selectedCard = { x: 32, y: 104, width: 300, height: 308 };
function canvasArea(x, y) {
  const left = x + selectedCard.x;
  const top = y + selectedCard.y;
  const handle = selectionHandle;
  const right = left + selectedCard.width;
  const bottom = top + selectedCard.height;
  const sizeLabel = sizeChip("300 × 308");
  return [
    at(text("Desktop / Selected work", 240, { size: 11, tone: 5 }), x, y - 24),
    at(use("artboard"), x, y),
    at(rect("Selection outline", selectedCard.width, selectedCard.height, { fill: null, stroke: 8 }), left, top),
    handle(left, top), handle(right, top), handle(left, bottom), handle(right, bottom),
    at(sizeLabel, left + (selectedCard.width - 72) / 2, bottom + 8),
  ];
}

define("layersPanel", "Shell / Layers panel", () => column("Layers panel", 240, [
  segmented(["レイヤー", "アセット"], 0, 224), layerList(224),
], { pad: 8, gap: 8, fill: 0, border: ["right"] }));

// アセットは文書全体で共有する定義（コンポーネント、色、余白）。各節の見出しに件数と追加の操作を置き、行ごとの操作は「⋯」メニューにまとめる。
// 件数は見出しの直後に置き、名前と一続きに読めるようにする。追加などの操作は右端にそろえる。
function assetHeader(title, count, actions) {
  const titleWidth = title.length * 12 + 4;
  const label = row("Title", titleWidth + 4 + 24, [text(title, titleWidth, { size: 11, tone: 8, weight: 600 }), text(count, 24, { size: 11, tone: 5 })], { height: 32, gap: 4 });
  return row("Section header", 224, [label, row("Actions", 72, actions.map((kind) => iconButton(kind)), { height: 32, gap: 4, justify: "end" })],
    { height: 32, justify: "space-between" });
}
function componentRow(name, highlighted = false) {
  const ref = define(`componentRow_${highlighted}`, `Assets / Component row${highlighted ? " / Highlighted" : ""}`, () =>
    row("Component row", 224, [icon("component", highlighted ? "primary" : 5), text("Component", 104, { tone: 8, weight: highlighted ? 600 : 400 }),
      ...(highlighted ? [iconButton("plus"), iconButton("more")] : [frame("Actions", 68, 1)])], { height: 32, pad: 8, gap: 4, fill: highlighted ? 2 : null, radius: 6 }));
  return use(ref, { [slot(ref, 1)]: { content: name } });
}
function colorRow(name, hex, tone, selected = false) {
  const ref = define(`colorRow_${selected}`, `Assets / Color row${selected ? " / Selected" : ""}`, () =>
    row("Color row", 224, [rect("Swatch", 16, 16, { fill: 0, stroke: 3, radius: 4 }), text("Name", selected ? 88 : 112, { tone: 8, weight: selected ? 600 : 400 }),
      text("#000000", 64, { size: 11, tone: 5, align: "right" }), ...(selected ? [icon("more", 6)] : [])], { height: 28, pad: 8, gap: 8, fill: selected ? 2 : null, radius: 6 }));
  return use(ref, { [slot(ref, 0)]: { fill: gray(tone) }, [slot(ref, 1)]: { content: name }, [slot(ref, 2)]: { content: hex } });
}
function spacingRow(name, value) {
  const ref = define("spacingRow", "Assets / Spacing row", () =>
    row("Spacing row", 224, [text("Name", 160, { tone: 8 }), text("0", 40, { size: 11, tone: 5, align: "right" })], { height: 28, pad: 8, gap: 8, radius: 6 }));
  return use(ref, { [slot(ref, 0)]: { content: name }, [slot(ref, 1)]: { content: value } });
}
const assetColors = [["Ink", "#171717", 8], ["Body", "#525252", 6], ["Muted", "#a3a3a3", 4], ["Line", "#e5e5e5", 2], ["Canvas", "#f5f5f5", 1], ["White", "#ffffff", 0]];
const assetSpacing = [["Card / Inset", "24"], ["Card / Gap", "16"], ["Grid / Gutter", "32"]];
// 選んだ色はその行の直下で編集する。アルファはアプリと同じく 0〜255 で入力する。
define("colorEditor", "Assets / Color editor", () => row("Color editor", 216, [
  field("HEX", "171717", { width: 128, labelWidth: 28 }), field("A", "255", { width: 80 }),
], { pad: 0, gap: 8 }));
define("assetsPanel", "Shell / Assets panel", () => column("Assets panel", 240, [
  segmented(["レイヤー", "アセット"], 1, 224),
  column("コンポーネント", 224, [assetHeader("コンポーネント", "3", []),
    componentRow("Project card", true), componentRow("Nav link"), componentRow("Button / Primary")]),
  divider(224),
  column("色", 224, [assetHeader("色", "6", ["import", "plus"]),
    ...assetColors.flatMap(([name, hex, tone], index) => index === 0 ? [colorRow(name, hex, tone, true), column("Selected color", 224, [use("colorEditor")], { pad: 4 })] : [colorRow(name, hex, tone)])]),
  divider(224),
  column("余白", 224, [assetHeader("余白", "3", ["plus"]), ...assetSpacing.map(([name, value]) => spacingRow(name, value))]),
], { pad: 8, gap: 8, fill: 0, border: ["right"] }));
define("componentMenu", "Assets / Component menu", () => column("Component menu", 200, [
  menuRow("キャンバスに配置"), menuRow("名前を変更"), menuRow("複製"), divider(184), menuRow("削除"),
], { pad: 8, gap: 4, fill: 0, stroke: 2, radius: 12 }));
define("colorMenu", "Assets / Color menu", () => column("Color menu", 200, [
  menuRow("名前を変更"), menuRow("複製"), divider(184), menuRow("削除"),
], { pad: 8, gap: 4, fill: 0, stroke: 2, radius: 12 }));

define("inspectorPanel", "Shell / Inspector panel", () => column("Inspector panel", 280, [use("inspector_frame")], { pad: 16, fill: 0, border: ["left"] }));

const floating = { pad: 4, gap: 4, fill: 0, stroke: 2, radius: 12 };
// 未保存の印は、名前を読まなくても保存状態が分かるようファイル名の直後に置く。
for (const unsaved of [false, true]) {
  for (const menuOpen of [false, true]) {
    define(`fileChip_${unsaved}_${menuOpen}`, "Canvas overlay / File", () => {
      const name = text("Website.nodi", unsaved ? 86 : 100, { size: 13, tone: 8, weight: 600 });
      const dot = { id: uid(), name: "Unsaved", x: 0, y: 0, width: 6, height: 6, type: "ellipse", style: { fill: gray(8) } };
      const trigger = row("File menu trigger", 140, unsaved ? [name, dot, icon("chevronDown", 5)] : [name, icon("chevronDown", 5)],
        { height: 32, pad: 8, gap: 8, fill: menuOpen ? 2 : null, radius: 8 });
      return row("File", 184, [iconButton("panelLeft"), trigger], floating);
    });
  }
}
function shortcutRow(label, shortcut) {
  const ref = define("shortcutRow", "Control / Menu row with shortcut", () =>
    row("Menu row", 224, [text("Item", 152, { tone: 7 }), text("⌘", 56, { size: 11, tone: 5, align: "right" })], { height: 28, pad: 8, radius: 6 }));
  return use(ref, { [slot(ref, 0)]: { content: label }, [slot(ref, 1)]: { content: shortcut } });
}
define("fileMenu", "Canvas overlay / File menu", () => column("File menu", 240, [
  column("Document", 224, [text("Website.nodi", 208, { size: 13, tone: 8, weight: 600 }), text("~/Documents/Website.nodi", 208, { size: 11, tone: 5 }),
    text("未保存の変更があります", 208, { size: 11, tone: 7 })], { pad: 8 }),
  divider(224), shortcutRow("開く…", "⌘O"), shortcutRow("保存", "⌘S"),
  divider(224), shortcutRow("SVG パスを取り込む…", ""),
  divider(224), shortcutRow("元に戻す", "⌘Z"), shortcutRow("やり直す", "⇧⌘Z"),
], { pad: 8, gap: 4, fill: 0, stroke: 2, radius: 12 }));
// ダイアログは確認と復元に共通の形にし、主となる操作を右端に置く。本文は行数を指定して折り返しを固定する。
function paragraph(content, width, lines, { size = 12, tone = 7 } = {}) {
  const node = text(content, width, { size, tone });
  return { ...node, height: Math.ceil((size + 4) / 4) * 4 * lines + 4 };
}
function button(label, primary) {
  const width = Math.ceil((label.length * 12 + 32) / 4) * 4;
  const ref = define(`button_${primary}_${width}`, `Control / Button / ${primary ? "Primary" : "Secondary"}`, () =>
    row("Button", width, [text("Label", width - 16, { tone: primary ? 0 : 8, weight: 600, align: "center" })],
      { height: 32, pad: 8, justify: "center", fill: primary ? 8 : 0, stroke: primary ? null : 3, radius: 8 }));
  return use(ref, { [slot(ref, 0)]: { content: label } });
}
const dialogWidth = 400;
function dialog(id, title, body, lines, path, [secondary, primary]) {
  return define(id, `Dialog / ${title}`, () => column("Dialog", dialogWidth, [
    column("Message", dialogWidth - 48, [text(title, dialogWidth - 48, { size: 15, tone: 8, weight: 600 }), paragraph(body, dialogWidth - 48, lines)], { gap: 8 }),
    ...(path ? [row("Path", dialogWidth - 48, [text(path, dialogWidth - 64, { size: 11, tone: 6 })], { height: 28, pad: 8, fill: 1, radius: 6 })] : []),
    row("Actions", dialogWidth - 48, [...(secondary ? [button(secondary, false)] : []), button(primary, true)], { gap: 8, justify: "end" }),
  ], { pad: 24, gap: 16, fill: 0, stroke: 2, radius: 12 }));
}
const dialogs = [
  dialog("dialog_external", "ファイルが外部で更新されました", "再読み込みすると、保存していない変更は破棄されます。", 1, "~/Documents/Website.nodi", ["今の内容を残す", "再読み込み"]),
  dialog("dialog_unsaved", "未保存の変更があります", "別のドキュメントを開くと、保存していない変更は失われます。", 1, null, ["キャンセル", "破棄して開く"]),
  dialog("dialog_recovery", "未保存の編集が見つかりました", "前回の異常終了時に残った編集内容です。復元しても元のファイルは上書きされず、保存するときに保存先を選べます。", 2, "元のファイル: ~/Documents/Website.nodi", ["破棄して開始", "編集を復元"]),
  dialog("dialog_recovery_error", "復元データを読み取れません", "復元データが壊れています。破棄すると、新しい空のドキュメントから始めます。", 2, null, [null, "破棄して開始"]),
];
// トーストは作成ツールと重ならないよう、キャンバスの右下の角に付ける。地を暗くして、グレースケールでもキャンバスと区別する。
// 幅はパネルを開いたときのキャンバスでも作成ツールとの間に間隔が残る大きさにする。
define("toast", "Canvas overlay / Toast", () => row("Toast", 280, [
  icon("alert", 0), paragraph("画像を読み込めませんでした: cover.png", 208, 2, { tone: 0 }), icon("close", 3),
], { pad: 12, gap: 8, fill: 8, radius: 8, align: "start" }));

define("actionChip", "Canvas overlay / Actions", () =>
  row("Actions", 128, [text("100%", 48, { tone: 6, align: "center" }), iconButton("preview"), iconButton("panelRight")], floating));
define("actionChip_preview", "Canvas overlay / Actions", () =>
  row("Actions", 128, [text("100%", 48, { tone: 6, align: "center" }), iconButton("preview", true), iconButton("panelRight")], floating));

// プレビューは選択中のフレームを指定した幅で描く。幅の切り換えはキャンバスの上中央に浮かべ、末尾のボタンで編集に戻る。
const previewWidths = ["320", "390", "768", "1024", "1440"];
const previewWidth = 390;
define("previewBar", "Canvas overlay / Preview widths", () => row("Preview widths", 389, [
  segmented(previewWidths, previewWidths.indexOf(String(previewWidth)), 248), field("幅", String(previewWidth), { width: 88 }), divider(1, 20), iconButton("close"),
], floating));
define("artboardNarrow", "Canvas / Selected work at 390", () => column("Desktop / Selected work", previewWidth, [
  text("Selected work", previewWidth - 48, { size: 30, tone: 8, weight: 600 }),
  { ...use("projectCard"), width: previewWidth - 48 }, { ...use("projectCard", { [slot("projectCard", 1)]: { content: "Everyday forms" } }), width: previewWidth - 48 },
], { pad: 24, gap: 24, fill: 0 }));
for (const timelineOpen of [false, true]) {
  define(`floatingTools_${timelineOpen}`, "Canvas overlay / Tools", () =>
    row("Tools", 297, [use("tools"), divider(1, 20), iconButton("timeline", timelineOpen)], floating));
}

const timelineSize = { width: 920, height: 228 };
const track = { left: 192, width: 712, duration: 800 };
const timeX = (time) => track.left + (track.width * time) / track.duration;
function keyframe(centerX, centerY, selected = false) {
  const size = selected ? 14 : 10;
  return at({ id: uid(), name: selected ? "Keyframe / Selected" : "Keyframe", x: 0, y: 0, width: size, height: size, type: "path",
    commands: [{ kind: "move", x: 0.5, y: 0 }, { kind: "line", x: 1, y: 0.5 }, { kind: "line", x: 0.5, y: 1 }, { kind: "line", x: 0, y: 0.5 }, { kind: "close" }],
    style: { fill: gray(selected ? 0 : 8), stroke: { color: gray(8), width: selected ? 2 : 1 } } }, centerX - size / 2, centerY - size / 2);
}
// スライダーは、つまみの位置で値の割合を示し、右端に値を出す。
function slider(label, value, ratio, { width = 248, labelWidth = 72, changed = true } = {}) {
  const trackWidth = width - labelWidth - 40 - 16;
  const knob = Math.round(trackWidth * ratio);
  const track = frame("Track", trackWidth, 16, [
    box("Rail", 0, 6, trackWidth, 4, { fill: 2, radius: 2 }), box("Rail filled", 0, 6, Math.max(knob, 1), 4, { fill: 8, radius: 2 }),
    { id: uid(), name: "Knob", x: Math.min(Math.max(knob - 6, 0), trackWidth - 12), y: 2, width: 12, height: 12, type: "ellipse", style: { fill: gray(0), stroke: { color: gray(8), width: 1 } } },
  ]);
  return row("Slider", width, [text(label, labelWidth, { size: 11, tone: 6 }), track, text(value, 40, { tone: changed ? 8 : 5, weight: changed ? 600 : 400, align: "right" })], { height: 28, gap: 8 });
}
function timelineFor(trigger) {
  const scroll = trigger === "スクロール";
  // スクロールで動くアニメーションは再生しないので、再生位置の線をスクロールの進み具合のつまみとして動かし、見出しには割合を出す。
  const playback = scroll
    ? row("Scroll progress", 176, [text("スクロール", 88, { size: 11, tone: 6, align: "right" }), text("40%", 40, { tone: 8, align: "center" }), iconButton("close")], { gap: 8 })
    : row("Playback", 176, [iconButton("play"), text("320 / 800 ms", 96, { tone: 6, align: "center" }), iconButton("close")], { gap: 8 });
  const header = row("Timeline header", timelineSize.width, [
    row("Animation settings", 721, [
      segmented(["Fade in", "Hover lift"], 0, 160), iconButton("plus"), iconButton("trash"), divider(1, 20),
      field("トリガー", trigger, { width: 132, labelWidth: 48 }), field("長さ", "800 ms", { width: 104, labelWidth: 28 }),
      field("遅延", "0 ms", { width: 96, labelWidth: 28 }), field("繰り返し", "1 回", { width: 108, labelWidth: 48 }),
    ], { gap: 8 }),
    playback,
  ], { height: 48, pad: 8, justify: "space-between", border: ["bottom"] });
  const tracks = [["不透明度", [[0], [400, true]]], ["Y 位置", [[0], [800]]]];
  const children = [at(header, 0, 0)];
  for (const time of [0, 200, 400, 600, 800]) {
    const label = time === 800 ? "800 ms" : String(time);
    const tick = text(label, 48, { size: 11, tone: 5, align: time === 0 ? "left" : time === 800 ? "right" : "center" });
    children.push(at(tick, time === 0 ? timeX(0) : time === 800 ? timeX(800) - 48 : timeX(time) - 24, 52));
  }
  tracks.forEach(([label, keyframes], index) => {
    const top = 76 + index * 32;
    children.push(at(text(label, 144, { tone: 7 }), 16, top + 6), at(rect("Track", track.width, 1, { fill: 2 }), track.left, top + 16));
    for (const [time, selected = false] of keyframes) children.push(keyframe(timeX(time), top + 16, selected));
  });
  children.push(
    at(row("Add track", 160, [icon("plus", 5), text("トラックを追加", 128, { tone: 5 })], { height: 32, pad: 8, gap: 8 }), 8, 140),
    at(rect("Track label divider", 1, 136, { fill: 2 }), 176, 48),
    at(rect("Playhead", 1, 128, { fill: 8 }), timeX(320), 56),
    at(rect("Playhead handle", 9, 8, { fill: 8, radius: 2 }), timeX(320) - 4, 48),
    at(row("Keyframe settings", timelineSize.width, [
      text("キーフレーム", 80, { size: 11, tone: 8, weight: 600 }), field("時刻", "400 ms", { width: 112, labelWidth: 28 }), field("値", "100%", { width: 96 }),
      segmented(["linear", "ease-in", "ease-out", "ease-in-out"], 2, 344), iconButton("keyframeAdd"), iconButton("trash"),
    ], { height: 44, pad: 8, gap: 8, border: ["top"] }), 0, 184),
  );
  return frame("Timeline", timelineSize.width, timelineSize.height, children, { fill: 0, border: ["top"] });
}
define("timeline", "Timeline / Fade in", () => timelineFor("読み込み"));
define("timeline_scroll", "Timeline / Scroll", () => timelineFor("スクロール"));

const overlayInset = 12;
// パネルの中に開くと下の節を隠すため、パネルの右隣に行の上端をそろえて開く。縦はパネル余白8 + タブ32 + 間隔8 + 見出し32。
const componentMenuAnchor = { x: 240 + 4, y: 8 + 32 + 8 + 32 };
function editor(id, name, index, { panelsOpen, timelineOpen = false, unsaved = false, fileMenuOpen = false, assetsOpen = false, dialogRef = null, toast = false, preview = false }) {
  const canvasLeft = panelsOpen ? 240 : 0;
  const canvasRight = panelsOpen ? 1160 : 1440;
  const centerOf = (width) => canvasLeft + (canvasRight - canvasLeft - width) / 2;
  const fileChip = use(`fileChip_${unsaved}_${fileMenuOpen}`);
  const actionChip = use(preview ? "actionChip_preview" : "actionChip");
  const tools = use(`floatingTools_${timelineOpen}`);
  const canvasBottom = timelineOpen ? 960 - timelineSize.height : 960;
  const previewBar = use("previewBar");
  const narrow = use("artboardNarrow");
  // プレビュー中は編集しないので、選択枠と作成ツールを出さない。
  const children = preview ? [
    at(text(`Desktop / Selected work · ${previewWidth} px`, 240, { size: 11, tone: 5 }), centerOf(narrow.width), 104 - 24),
    at(narrow, centerOf(narrow.width), 104),
    at(fileChip, canvasLeft + overlayInset, overlayInset),
    at(actionChip, canvasRight - overlayInset - actionChip.width, overlayInset),
    at(previewBar, centerOf(previewBar.width), overlayInset),
  ] : [
    ...canvasArea(centerOf(780), (canvasBottom - 460) / 2),
    at(fileChip, canvasLeft + overlayInset, overlayInset),
    at(actionChip, canvasRight - overlayInset - actionChip.width, overlayInset),
    at(tools, centerOf(tools.width), canvasBottom - overlayInset - tools.height),
  ];
  if (timelineOpen) children.push(at(use("timeline"), canvasLeft, canvasBottom));
  if (fileMenuOpen) children.push(at(use("fileMenu"), canvasLeft + overlayInset, overlayInset + fileChip.height + 8));
  if (panelsOpen) children.push(at({ ...use(assetsOpen ? "assetsPanel" : "layersPanel"), height: 960 }, 0, 0), at({ ...use("inspectorPanel"), height: 960 }, 1160, 0));
  if (assetsOpen) children.push(at(use("componentMenu"), componentMenuAnchor.x, componentMenuAnchor.y));
  if (toast) {
    const node = use("toast");
    children.push(at(node, canvasRight - overlayInset - node.width, canvasBottom - overlayInset - node.height));
  }
  // ダイアログは画面全体を覆う幕の上で、画面の中央に開く。
  if (dialogRef) {
    const node = use(dialogRef);
    children.push({ ...at(rect("Scrim", 1440, 960, { fill: 9 }), 0, 0), opacity: 0.24 }, at(node, (1440 - node.width) / 2, (960 - node.height) / 2));
  }
  return { ...frame(name, 1440, 960, children, { fill: 2 }), id, x: (index % 2) * 1520 + 80, y: Math.floor(index / 2) * 1040 + 80 };
}

const screens = [
  editor("screen_panels_open", "A / パネルを開いた状態", 0, { panelsOpen: true }),
  editor("screen_panels_closed", "A / パネルを閉じた状態", 1, { panelsOpen: false }),
  editor("screen_timeline_open", "A / タイムラインを開いた状態", 2, { panelsOpen: true, timelineOpen: true }),
  editor("screen_file_menu", "A / ファイルメニューを開いた状態", 3, { panelsOpen: true, unsaved: true, fileMenuOpen: true }),
  editor("screen_assets", "A / アセットを開いた状態", 4, { panelsOpen: true, assetsOpen: true }),
  editor("screen_dialog", "A / 外部変更のダイアログを開いた状態", 5, { panelsOpen: true, unsaved: true, dialogRef: "dialog_external" }),
  editor("screen_toast", "A / エラーを表示した状態", 6, { panelsOpen: true, toast: true }),
  editor("screen_preview", "A / 幅を切り換えてプレビューした状態", 7, { panelsOpen: false, preview: true }),
];
const sheetColumns = [...Object.keys(inspectorKinds).map((kind) => ({ title: inspectorTitles[kind], node: column("Inspector panel", 280, [use(`inspector_${kind}`)], { pad: 16, fill: 0, radius: 12 }) })),
  { title: "⋯ メニュー", node: use("moreMenu") }, { title: "アセットの色の ⋯ メニュー", node: use("colorMenu") }];
const sheetHeight = 76 + Math.max(...sheetColumns.map(({ node }) => node.height)) + 40;
let sheetX = 40;
const sheetChildren = sheetColumns.flatMap(({ title, node }) => {
  const placed = [at(text(title, 200, { size: 13, tone: 8, weight: 600 }), sheetX, 40), at(node, sheetX, 76)];
  sheetX += node.width + 40;
  return placed;
});
const inspectorSheet = { ...frame("Inspector / 種類ごとの構成", sheetX, sheetHeight, sheetChildren, { fill: 2 }), id: "sheet_inspector", x: 80, y: Math.ceil(screens.length / 2) * 1040 + 80 };
screens.push(inspectorSheet);

const dialogColumns = [...dialogs.map((ref) => ({ title: components.find((item) => item.id === ref).name.replace("Dialog / ", ""), node: use(ref) })),
  { title: "エラーのトースト", node: use("toast") }];
let dialogX = 40;
const dialogChildren = dialogColumns.flatMap(({ title, node }) => {
  const placed = [at(text(title, node.width, { size: 13, tone: 8, weight: 600 }), dialogX, 40), at(node, dialogX, 76)];
  dialogX += node.width + 40;
  return placed;
});
const dialogSheetHeight = 76 + Math.max(...dialogColumns.map(({ node }) => node.height)) + 40;
screens.push({ ...frame("Dialog / 種類ごとの文言", dialogX, dialogSheetHeight, dialogChildren, { fill: 2 }), id: "sheet_dialogs", x: 80, y: inspectorSheet.y + inspectorSheet.height + 80 });

// 編集中にキャンバスへ重ねる表示を、場面ごとのタイルに並べる。
function vectorPath(name, commands, style) {
  const xs = commands.flatMap((c) => c.kind === "close" ? [] : c.kind === "cubic" ? [c.x1, c.x2, c.x] : [c.x]);
  const ys = commands.flatMap((c) => c.kind === "close" ? [] : c.kind === "cubic" ? [c.y1, c.y2, c.y] : [c.y]);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  const [width, height] = [Math.max(Math.max(...xs) - left, 1), Math.max(Math.max(...ys) - top, 1)];
  const nx = (x) => (x - left) / width;
  const ny = (y) => (y - top) / height;
  return { id: uid(), name, x: left, y: top, width, height, type: "path", style,
    commands: commands.map((c) => c.kind === "close" ? c : c.kind === "cubic"
      ? { kind: "cubic", x1: nx(c.x1), y1: ny(c.y1), x2: nx(c.x2), y2: ny(c.y2), x: nx(c.x), y: ny(c.y) }
      : { kind: c.kind, x: nx(c.x), y: ny(c.y) }) };
}
const M = (x, y) => ({ kind: "move", x, y });
const L = (x, y) => ({ kind: "line", x, y });
const C = (x1, y1, x2, y2, x, y) => ({ kind: "cubic", x1, y1, x2, y2, x, y });
const line = (name, x1, y1, x2, y2, tone = 8) => vectorPath(name, [M(x1, y1), L(x2, y2)], { fill: null, stroke: { color: gray(tone), width: 1 } });
const outline = (x, y, width, height) => box("Selection outline", x, y, width, height, { fill: null, stroke: 8 });
const handlesOf = (x, y, width, height) => [selectionHandle(x, y), selectionHandle(x + width, y), selectionHandle(x, y + height), selectionHandle(x + width, y + height)];
const chipAt = (label, centerX, top) => at(sizeChip(label), centerX - 36, top);
// 間隔の札は狭い隙間に収まるよう、寸法の札より細くする。
function distanceChip(label, centerX, top) {
  const ref = define("distanceChip", "Canvas / Distance label", () =>
    row("Distance label", 32, [text("0", 24, { size: 11, tone: 0, align: "center" })], { height: 20, pad: 4, justify: "center", fill: 8, radius: 4 }));
  return at(use(ref, { [slot(ref, 0)]: { content: label } }), centerX - 16, top);
}
const anchor = (centerX, centerY, selected = false) => box(selected ? "Anchor / Selected" : "Anchor", centerX - 4, centerY - 4, 8, 8, { fill: selected ? 8 : 0, stroke: 8 });
const bezierHandle = (fromX, fromY, toX, toY) => [line("Handle line", fromX, fromY, toX, toY, 6),
  { id: uid(), name: "Bezier handle", x: toX - 3, y: toY - 3, width: 6, height: 6, type: "ellipse", style: { fill: gray(0), stroke: { color: gray(8), width: 1 } } }];
const block = (name, x, y, width, height) => box(name, x, y, width, height, { fill: 1, stroke: 3 });
const hint = (content) => at(text(content, 352, { size: 11, tone: 5 }), 24, 272);
const tileSize = { width: 400, height: 300 };
const artboardRect = () => box("Artboard", 24, 24, 352, 240, { fill: 0 });

const canvasTiles = [
  ["範囲選択", () => [
    artboardRect(), block("Card A", 56, 56, 96, 72), block("Card B", 184, 56, 96, 72), block("Card C", 56, 160, 96, 72), block("Card D", 184, 160, 96, 72),
    { ...box("Marquee fill", 40, 44, 264, 96, { fill: 8 }), opacity: 0.06 }, box("Marquee", 40, 44, 264, 96, { fill: null, stroke: 8 }),
    outline(56, 56, 96, 72), outline(184, 56, 96, 72), hint("ドラッグした範囲に掛かる要素を選ぶ"),
  ]],
  ["Shift で加算選択", () => [
    artboardRect(), block("Card A", 56, 56, 96, 72), block("Card B", 184, 56, 96, 72), block("Card C", 56, 160, 96, 72), block("Card D", 184, 160, 96, 72),
    outline(56, 56, 96, 72), outline(184, 160, 96, 72), outline(56, 56, 224, 176), ...handlesOf(56, 56, 224, 176), chipAt("224 × 176", 168, 240),
    hint("個々の要素の枠と、まとめた範囲の枠とつまみを出す"),
  ]],
  ["スナップと整列ガイド", () => [
    artboardRect(), block("Card A", 56, 72, 120, 96), block("Card B", 232, 72, 104, 96),
    line("Guide", 32, 72, 368, 72), line("Guide", 32, 168, 368, 168), line("Distance", 176, 120, 232, 120),
    distanceChip("56", 204, 128), outline(232, 72, 104, 96), ...handlesOf(232, 72, 104, 96),
    hint("そろった辺にガイドを引き、隣との間隔を札で出す"),
  ]],
  ["楕円を描いている途中", () => [
    artboardRect(), { id: uid(), name: "Ellipse", x: 120, y: 64, width: 160, height: 120, type: "ellipse", style: { fill: gray(1), stroke: { color: gray(8), width: 1 } } },
    outline(120, 64, 160, 120), ...handlesOf(120, 64, 160, 120), chipAt("160 × 120", 200, 196), hint("ドラッグ中は外接する枠と寸法を出す。Shift で正円"),
  ]],
  ["ペンで描いている途中", () => [
    artboardRect(),
    vectorPath("Path", [M(72, 200), C(96, 120, 136, 96, 176, 104), C(216, 112, 232, 176, 272, 176)], { fill: null, stroke: { color: gray(8), width: 1.5 } }),
    line("Next segment", 272, 176, 336, 88, 5),
    anchor(72, 200), anchor(176, 104), ...bezierHandle(272, 176, 232, 176), ...bezierHandle(272, 176, 312, 176), anchor(272, 176, true),
    hint("クリックで点、ドラッグで曲線。Enter で確定、Esc で取り消し"),
  ]],
  ["パスの点の編集", () => [
    artboardRect(),
    vectorPath("Path", [M(96, 192), C(80, 120, 144, 64, 200, 72), C(256, 80, 312, 112, 304, 176), C(296, 224, 200, 232, 160, 216), L(96, 192), { kind: "close" }],
      { fill: gray(1), stroke: { color: gray(8), width: 1.5 } }),
    anchor(96, 192), ...bezierHandle(200, 72, 144, 64), ...bezierHandle(200, 72, 256, 80), anchor(200, 72, true), anchor(304, 176), anchor(160, 216),
    hint("選んだ点を紫で塗り、その点のハンドルだけを出す"),
  ]],
  ["マスク", () => {
    const tag = (content) => row("Tag", 48, [text(content, 40, { size: 11, tone: 6, align: "center" })], { height: 20, pad: 4, justify: "center", fill: 2, radius: 4 });
    const maskLayer = (name, kind, depth, label) => {
      const children = [icon(kind, 5), text(name, depth ? 48 : 64, { tone: 7 })];
      if (depth) children.unshift(frame("Indent", 12, 1));
      if (label) children.push(tag(label));
      return row("Layer row", 152, children, { height: 28, pad: 8, gap: 4, radius: 6 });
    };
    return [
      artboardRect(),
      at(column("Layers", 168, [maskLayer("Mask", "ellipse", 0, "マスク"), maskLayer("Cover", "image", 1, null), maskLayer("Title", "text", 0, null)], { pad: 8, fill: 1, radius: 8 }), 32, 32),
      { ...box("Masked out", 208, 48, 152, 200, { fill: 4 }), opacity: 0.16 },
      { id: uid(), name: "Masked image", x: 216, y: 72, width: 136, height: 152, type: "ellipse", style: { fill: gray(4) } },
      { id: uid(), name: "Mask outline", x: 216, y: 72, width: 136, height: 152, type: "ellipse", style: { fill: null, stroke: { color: gray(8), width: 1 } } },
      hint("外側は薄く出し、レイヤーには「マスク」の札を付ける"),
    ];
  }],
  ["画像", () => [
    artboardRect(), box("Image", 104, 56, 192, 144, { fill: 3, radius: 12 }),
    at({ ...use(define("icon_image_large", "Icon / image large", () => ({ ...iconPathNode("image", 0), width: 48, height: 48 }))) }, 176, 104),
    outline(104, 56, 192, 144), ...handlesOf(104, 56, 192, 144), chipAt("192 × 144", 200, 212),
    hint("取り込んだ画像は角丸で切り抜き、中央に置いて選ぶ"),
  ]],
];
let canvasColumn = 0;
const canvasSheetChildren = canvasTiles.flatMap(([title, build], index) => {
  const x = 40 + (index % 4) * (tileSize.width + 40);
  const y = 40 + Math.floor(index / 4) * (tileSize.height + 76);
  canvasColumn = Math.max(canvasColumn, index % 4);
  return [at(text(title, tileSize.width, { size: 13, tone: 8, weight: 600 }), x, y),
    at(frame(title, tileSize.width, tileSize.height, build(), { fill: 2, stroke: 3, radius: 12 }), x, y + 36)];
});
const lastSheet = screens.at(-1);
screens.push({ ...frame("Canvas / 編集中の表示", 40 + 4 * (tileSize.width + 40), 40 + 2 * (tileSize.height + 76), canvasSheetChildren, { fill: 2 }),
  id: "sheet_canvas", x: 80, y: lastSheet.y + lastSheet.height + 80 });

// グラデーションの帯は、色の位置を帯の下の札で示し、選んだ札を紫で塗る。
function gradientBar(kind, stops, selected) {
  const width = 248;
  const fillOf = kind === "線形"
    ? { type: "linear", start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, stops: stops.map(([position, tone]) => ({ position, color: gray(tone) })) }
    : { type: "radial", center: { x: 0.5, y: 0.5 }, radius: 1, stops: stops.map(([position, tone]) => ({ position, color: gray(tone) })) };
  const bar = { ...rect("Gradient", width, 24, { stroke: 3, radius: 4 }), style: { fill: fillOf, stroke: { color: gray(3), width: 1 }, cornerRadii: corners(4) } };
  const markers = stops.map(([position, tone], index) => {
    const x = Math.min(Math.max(position * width - 6, 0), width - 12);
    return box(index === selected ? "Stop / Selected" : "Stop", x, 28, 12, 12, { fill: index === selected ? 8 : tone, stroke: 8, radius: 3 });
  });
  return frame("Gradient stops", width, 40, [at(bar, 0, 0), ...markers]);
}
function gradientPanel(kind, stops, selected, geometry) {
  const [position, tone] = stops[selected];
  return column(`塗り / ${kind}`, 248, [
    sectionHeader("塗り", "remove"), segmented(["単色", "線形", "放射状"], kind === "線形" ? 1 : 2, 248), gradientBar(kind, stops, selected),
    row("Stop", 248, [field("位置", `${Math.round(position * 100)}%`, { width: 80, labelWidth: 28 }), colorField(grayNames[tone], "100%", 128), iconButton("trash")], { gap: 4 }),
    ...geometry,
  ], { gap: 8 });
}
const filterRows = [["明るさ", "100%", 0.5, false], ["コントラスト", "120%", 0.6, true], ["彩度", "100%", 0.5, false], ["グレースケール", "0%", 0, false], ["セピア", "0%", 0, false], ["色相", "0°", 0.5, false]];
const controlColumns = [
  { title: "塗り（線形）", node: gradientPanel("線形", [[0, 1], [0.6, 4], [1, 8]], 1, [
    pair(field("始点 X", "0%", { labelWidth: 40 }), field("始点 Y", "50%", { labelWidth: 40 })),
    pair(field("終点 X", "100%", { labelWidth: 40 }), field("終点 Y", "50%", { labelWidth: 40 })), caption("帯をクリックすると色の位置を足す"),
  ]) },
  { title: "塗り（放射状）", node: gradientPanel("放射状", [[0, 0], [1, 6]], 0, [
    pair(field("中心 X", "50%", { labelWidth: 40 }), field("中心 Y", "50%", { labelWidth: 40 })), field("半径", "100%", { width: 248, labelWidth: 28 }),
  ]) },
  { title: "画像の色調整", node: column("色調整", 248, [
    row("Heading", 248, [row("Back", 200, [icon("chevronLeft", 6), text("色調整", 176, { size: 11, tone: 8, weight: 600 })], { height: 24, gap: 4 }), icon("reset", 5)],
      { height: 24, justify: "space-between" }),
    ...filterRows.map(([label, value, ratio, changed]) => slider(label, value, ratio, { labelWidth: 84, changed })), caption("既定値から変えた行だけ、値を濃く出す"),
  ], { gap: 8 }) },
];
let controlX = 40;
const controlChildren = controlColumns.flatMap(({ title, node }) => {
  const panel = column("Inspector panel", 280, [node], { pad: 16, fill: 0, radius: 12 });
  const placed = [at(text(title, 280, { size: 13, tone: 8, weight: 600 }), controlX, 40), at(panel, controlX, 76)];
  controlX += 280 + 40;
  return placed;
});
const timelineScroll = use("timeline_scroll");
controlChildren.push(at(text("スクロールで動くアニメーション", 400, { size: 13, tone: 8, weight: 600 }), controlX, 40), at(timelineScroll, controlX, 76));
const controlHeight = 76 + Math.max(timelineSize.height, ...controlColumns.map(({ node }) => node.height + 32)) + 40;
const previousSheet = screens.at(-1);
screens.push({ ...frame("Controls / 値を動かす入力", controlX + timelineSize.width + 40, controlHeight, controlChildren, { fill: 2 }),
  id: "sheet_controls", x: 80, y: previousSheet.y + previousSheet.height + 80 });

for (const ref of ["layersPanel", "assetsPanel", "inspectorPanel"]) components.find((item) => item.id === ref).node.height = 960;

// 主役の紫は、選択、再生位置、主となる操作に絞って載せる。それ以外は灰色のまま残す。
const accentNames = new Set(["Selection outline", "Handle", "Playhead", "Playhead handle", "Keyframe", "Keyframe / Selected", "Unsaved", "Rail filled", "Anchor", "Anchor / Selected", "Stop / Selected", "Guide", "Distance", "Marquee"]);
const isRef = (color, id) => color?.type === "palette" && color.id === id;
function accent(node, name = node.name, tinted = false) {
  const style = node.style ? { ...node.style } : node.style;
  const toPrimary = (color, step) => (isRef(color, "neutral_900") ? primary(step) : color);
  let childTinted = tinted;
  if (style) {
    // 選択中の行と押されたボタンは、地を淡い紫にし、中の文字と線を濃い紫にする。
    const selectedRow = /Selected|Highlighted/.test(name) && /Layer row|Component row|Color row/.test(name);
    const activeButton = name.startsWith("Control / Icon button") && isRef(style.fill, "neutral_100");
    if (selectedRow || activeButton) {
      if (isRef(style.fill, "neutral_100")) style.fill = primary("050");
      childTinted = true;
    } else if (tinted) {
      if (style.color) style.color = toPrimary(style.color, "800");
      if (style.stroke) style.stroke = { ...style.stroke, color: toPrimary(style.stroke.color, "700") };
    }
    if (accentNames.has(name)) {
      style.fill = toPrimary(style.fill, "500");
      if (style.stroke) style.stroke = { ...style.stroke, color: toPrimary(style.stroke.color, "500") };
    } else if (["Canvas / Size label", "Canvas / Distance label", "Box", "Control / Button / Primary"].includes(name)) {
      style.fill = toPrimary(style.fill, "600");
    }
  }
  const next = { ...node, style };
  if (node.type === "frame") next.children = node.children.map((child) => accent(child, child.name, childTinted));
  return next;
}
for (const definition of components) definition.node = accent(definition.node, definition.name);
for (const [index, screen] of screens.entries()) screens[index] = accent(screen);

export const designDocument = { version: 1, children: screens, palette, spacing, components };
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL("./nodi.nodi", import.meta.url), JSON.stringify(designDocument, null, 2) + "\n");
}
