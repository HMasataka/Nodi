import { DEFAULT_IMAGE_FILTERS, type ImageFilters, type ImageFit, type ImageNode, type ImageStyle } from "@/document/types";

import { Field } from "@/pages/editor/components/atoms/Field";
import { Icon } from "@/pages/editor/components/atoms/Icon";
import { IconButton } from "@/pages/editor/components/atoms/IconButton";
import { Segmented } from "@/pages/editor/components/atoms/Segmented";
import { Slider } from "@/pages/editor/components/atoms/Slider";

const FITS: readonly { value: ImageFit; label: string }[] = [{ value: "cover", label: "切り抜き" }, { value: "contain", label: "収める" }, { value: "fill", label: "伸ばす" }];

// 色調整の6項目。スライダーは % か度の整数で動かし、保存する値は倍率（色相は度）にする。
export const FILTER_SLIDERS: readonly { key: keyof ImageFilters; label: string; min: number; max: number; unit: "%" | "°" }[] = [
  { key: "brightness", label: "明るさ", min: 0, max: 200, unit: "%" },
  { key: "contrast", label: "コントラスト", min: 0, max: 200, unit: "%" },
  { key: "saturate", label: "彩度", min: 0, max: 200, unit: "%" },
  { key: "grayscale", label: "グレースケール", min: 0, max: 100, unit: "%" },
  { key: "sepia", label: "セピア", min: 0, max: 100, unit: "%" },
  { key: "hueRotate", label: "色相", min: -180, max: 180, unit: "°" },
];

const toSlider = (key: keyof ImageFilters, value: number) => key === "hueRotate" ? Math.round(value) : Math.round(value * 100);
const fromSlider = (key: keyof ImageFilters, value: number) => key === "hueRotate" ? value : value / 100;

export function filtersChanged(filters: ImageFilters): boolean {
  return FILTER_SLIDERS.some(({ key }) => filters[key] !== DEFAULT_IMAGE_FILTERS[key]);
}

// 画像の節。フィットと焦点を並べ、「色調整」で下位の画面を開く。
export function ImageStyleEditor({ node: { style }, onChange, onOpenAdjustments }: { node: ImageNode; onChange(style: Partial<ImageStyle>): void; onOpenAdjustments(): void }) {
  return <div className="image-style-fields">
    <Segmented<ImageFit> label="フィット" value={style.fit} options={FITS} onChange={(fit) => onChange({ fit })} />
    <div className="field-pair">
      {(["x", "y"] as const).map((axis) => <Field key={axis} className="is-wider-label" label={`焦点 ${axis.toUpperCase()}`} type="number" min="0" max="100" step="any"
        value={String(Number((style.focalPoint[axis] * 100).toFixed(2)))}
        onCommit={(raw) => onChange({ focalPoint: { ...style.focalPoint, [axis]: raw.trim() === "" ? NaN : Number(raw) / 100 } })} />)}
    </div>
    <button type="button" className="link-row" onClick={onOpenAdjustments}>
      <span>色調整</span>
      {filtersChanged(style.filters) && <span className="link-row-note">変更あり</span>}
      <Icon name="chevronRight" />
    </button>
  </div>;
}

// 色調整の下位の画面。見出しの左で戻り、右端で既定値に戻す。既定値から変えた行だけ値を濃く出す。
export function ImageAdjustments({ filters, onChange, onBack }: { filters: ImageFilters; onChange(filters: ImageFilters): void; onBack(): void }) {
  return <div className="image-adjustments">
    <div className="image-adjustments-heading">
      <button type="button" className="image-adjustments-back" onClick={onBack}><Icon name="chevronLeft" /><span>色調整</span></button>
      <IconButton icon="reset" label="既定値に戻す" disabled={!filtersChanged(filters)} onClick={() => onChange({ ...DEFAULT_IMAGE_FILTERS })} />
    </div>
    {FILTER_SLIDERS.map(({ key, label, min, max, unit }) => <Slider key={key} label={label} min={min} max={max}
      value={toSlider(key, filters[key])} defaultValue={toSlider(key, DEFAULT_IMAGE_FILTERS[key])} format={(value) => `${value}${unit}`}
      onChange={(value) => onChange({ ...filters, [key]: fromSlider(key, value) })} />)}
  </div>;
}
