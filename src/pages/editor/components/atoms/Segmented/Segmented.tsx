import { type KeyboardEvent, useRef } from "react";

export type SegmentedOption<T extends string> = { value: T; label: string };

// 矢印キーと Home・End で移る先の位置。端では反対の端へ回り込む。対象外のキーは null。
export function nextSegmentIndex(key: string, index: number, count: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange(value: T): void;
  className?: string;
};

// 選択肢を横に並べて1つを選ぶ切り換え。radiogroup として、選んだ項目だけを Tab で止まる位置にする。
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextSegmentIndex(event.key, index, options.length);
    if (next === null) return;
    event.preventDefault();
    items.current[next]?.focus();
    if (options[next].value !== value) onChange(options[next].value);
  }
  return <div role="radiogroup" aria-label={label} className={className ? `segmented ${className}` : "segmented"}>
    {options.map((option, index) => (
      <button key={option.value} ref={(element) => { items.current[index] = element; }} type="button" role="radio"
        className="segmented-item" aria-checked={index === selected} tabIndex={index === selected ? 0 : -1}
        onClick={() => { if (option.value !== value) onChange(option.value); }} onKeyDown={(event) => move(event, index)}>
        {option.label}
      </button>
    ))}
  </div>;
}
