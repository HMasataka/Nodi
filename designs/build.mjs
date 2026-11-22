import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let serial = 0;
const uid = () => `ui_${++serial}`;

const grayNames = ["White", "Canvas", "Line", "Border", "Muted", "Secondary", "Body", "Strong", "Ink", "Black"];
const palette = ["ffffff", "f5f5f5", "e5e5e5", "d4d4d4", "a3a3a3", "737373", "525252", "404040", "171717", "000000"]
  .map((hex, index) => ({ id: `gray_${index}`, name: grayNames[index], color: `#${hex}` }));
const spacing = [0, 4, 8, 12, 16, 20, 24, 32].map((value) => ({ id: `space_${value}`, name: `Space / ${value}`, value }));
const gray = (index) => ({ type: "palette", id: `gray_${index}` });
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
  close: [[0.25, 0.25], [0.75, 0.75], null, [0.75, 0.25], [0.25, 0.75]],
  plus: [[0.5, 0.2], [0.5, 0.8], null, [0.2, 0.5], [0.8, 0.5]],
  chevronDown: [[0.28, 0.4], [0.5, 0.62], [0.72, 0.4]],
};
function icon(kind, tone = 6) {
  return use(define(`icon_${kind}_${tone}`, `Icon / ${kind}`, () => {
    let move = true;
    const commands = iconPaths[kind].flatMap((point) => {
      if (point === null) { move = true; return []; }
      if (point === "close") return [{ kind: "close" }];
      const command = { kind: move ? "move" : "line", x: point[0], y: point[1] };
      move = false;
      return [command];
    });
    return { id: uid(), name: kind, x: 0, y: 0, width: 16, height: 16, type: "path", commands, style: { fill: null, stroke: { color: gray(tone), width: 1.5 } } };
  }));
}

function iconButton(kind, active = false) {
  return use(define(`iconButton_${kind}_${active}`, `Control / Icon button / ${kind}`, () =>
    row(kind, 32, [icon(kind, active ? 8 : 6)], { height: 32, pad: 8, justify: "center", fill: active ? 2 : null, radius: 6 })));
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

function sectionHeader(title, width = 248) {
  const ref = define(`sectionHeader_${width}`, "Inspector / Section header", () =>
    row("Section header", width, [text("見出し", width - 24, { size: 11, tone: 8, weight: 600 }), icon("plus", 5)], { height: 24, justify: "space-between" }));
  return use(ref, { [slot(ref, 0)]: { content: title } });
}

function layerRow(name, kind, depth, selected, width) {
  const ref = define(`layer_${width}_${kind}_${depth}_${selected}`, `Navigation / Layer row${selected ? " / Selected" : ""}`, () => {
    const indent = depth * 16;
    const children = [icon(kind, selected ? 8 : 5), text("Layer", width - 16 - 16 - 8 - (indent ? indent + 8 : 0), { tone: selected ? 8 : 7, weight: selected ? 600 : 400 })];
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

define("inspector", "Inspector / Frame", () => {
  const pair = (first, second) => row("Pair", 248, [first, second], { gap: 8 });
  const section = (title, controls) => column(title, 248, [sectionHeader(title), ...controls], { gap: 8 });
  return column("Inspector", 248, [
    column("Selection", 248, [text("フレーム", 248, { size: 11, tone: 5 }), text("Project card", 248, { size: 14, tone: 8, weight: 600 })], { gap: 0 }),
    divider(248),
    section("位置とサイズ", [pair(field("X", "364"), field("Y", "104")), pair(field("W", "300"), field("H", "308"))]),
    divider(248),
    section("自動レイアウト", [segmented(["なし", "縦", "横"], 1, 248), pair(field("間隔", "16", { labelWidth: 28 }), field("余白", "24", { labelWidth: 28 })),
      segmented(["始点", "中央", "終点"], 0, 248)]),
    divider(248),
    section("塗り", [colorField("Canvas", "100%")]),
    divider(248), sectionHeader("線"),
    divider(248), sectionHeader("効果"),
    divider(248),
    section("アニメーション", [animationRow("Fade in", "読み込み"), animationRow("Hover lift", "ホバー")]),
  ], { gap: 12 });
});

define("projectCard", "Content / Project card", () => column("Project card", 300, [
  rect("Cover", 252, 176, { fill: 3 }), text("Quiet objects", 252, { size: 22, tone: 8, weight: 600 }), text("Art direction / 2026", 252, { tone: 5 }),
], { pad: 24, gap: 16, fill: 1 }));
define("artboard", "Canvas / Selected work", () => frame("Desktop / Selected work", 780, 460, [
  at(text("Selected work", 600, { size: 30, tone: 8, weight: 600 }), 32, 24),
  at(use("projectCard"), 32, 104),
  at(use("projectCard", { [slot("projectCard", 1)]: { content: "Everyday forms" } }), 364, 104),
], { fill: 0 }));

const selectedCard = { x: 32, y: 104, width: 300, height: 308 };
function canvasArea(x, y) {
  const left = x + selectedCard.x;
  const top = y + selectedCard.y;
  const handle = (handleX, handleY) => at(rect("Handle", 8, 8, { fill: 0, stroke: 8 }), handleX - 4, handleY - 4);
  const right = left + selectedCard.width;
  const bottom = top + selectedCard.height;
  const sizeLabel = row("Size label", 72, [text("300 × 308", 64, { size: 11, tone: 0, align: "center" })], { height: 20, pad: 4, justify: "center", fill: 8, radius: 4 });
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
define("inspectorPanel", "Shell / Inspector panel", () => column("Inspector panel", 280, [use("inspector")], { pad: 16, fill: 0, border: ["left"] }));

const floating = { pad: 4, gap: 4, fill: 0, stroke: 2, radius: 12 };
define("fileChip", "Canvas overlay / File", () =>
  row("File", 152, [iconButton("panelLeft"), text("Website.nodi", 108, { size: 13, tone: 8, weight: 600 })], floating));
define("actionChip", "Canvas overlay / Actions", () =>
  row("Actions", 128, [text("100%", 48, { tone: 6, align: "center" }), iconButton("preview"), iconButton("panelRight")], floating));
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
define("timeline", "Timeline / Fade in", () => {
  const header = row("Timeline header", timelineSize.width, [
    row("Animation settings", 721, [
      segmented(["Fade in", "Hover lift"], 0, 160), iconButton("plus"), iconButton("trash"), divider(1, 20),
      field("トリガー", "読み込み", { width: 132, labelWidth: 48 }), field("長さ", "800 ms", { width: 104, labelWidth: 28 }),
      field("遅延", "0 ms", { width: 96, labelWidth: 28 }), field("繰り返し", "1 回", { width: 108, labelWidth: 48 }),
    ], { gap: 8 }),
    row("Playback", 176, [iconButton("play"), text("320 / 800 ms", 96, { tone: 6, align: "center" }), iconButton("close")], { gap: 8 }),
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
});

const overlayInset = 12;
function editor(id, name, index, { panelsOpen, timelineOpen = false }) {
  const canvasLeft = panelsOpen ? 240 : 0;
  const canvasRight = panelsOpen ? 1160 : 1440;
  const centerOf = (width) => canvasLeft + (canvasRight - canvasLeft - width) / 2;
  const fileChip = use("fileChip");
  const actionChip = use("actionChip");
  const tools = use(`floatingTools_${timelineOpen}`);
  const canvasBottom = timelineOpen ? 960 - timelineSize.height : 960;
  const children = [
    ...canvasArea(centerOf(780), (canvasBottom - 460) / 2),
    at(fileChip, canvasLeft + overlayInset, overlayInset),
    at(actionChip, canvasRight - overlayInset - actionChip.width, overlayInset),
    at(tools, centerOf(tools.width), canvasBottom - overlayInset - tools.height),
  ];
  if (timelineOpen) children.push(at(use("timeline"), canvasLeft, canvasBottom));
  if (panelsOpen) children.push(at({ ...use("layersPanel"), height: 960 }, 0, 0), at({ ...use("inspectorPanel"), height: 960 }, 1160, 0));
  return { ...frame(name, 1440, 960, children, { fill: 2 }), id, x: (index % 2) * 1520 + 80, y: Math.floor(index / 2) * 1040 + 80 };
}

const screens = [
  editor("screen_panels_open", "A / パネルを開いた状態", 0, { panelsOpen: true }),
  editor("screen_panels_closed", "A / パネルを閉じた状態", 1, { panelsOpen: false }),
  editor("screen_timeline_open", "A / タイムラインを開いた状態", 2, { panelsOpen: true, timelineOpen: true }),
];
for (const ref of ["layersPanel", "inspectorPanel"]) components.find((item) => item.id === ref).node.height = 960;

export const designDocument = { version: 1, children: screens, palette, spacing, components };
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL("./nodi.nodi", import.meta.url), JSON.stringify(designDocument, null, 2) + "\n");
}
