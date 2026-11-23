import type { InputHTMLAttributes } from "react";

import { Icon } from "@/pages/editor/components/atoms/Icon";

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "defaultChecked" | "onChange">;

// 16px の箱とラベルを並べたチェックボックス。オンは紫の地に白いチェックを出す。
export function Checkbox({ label, checked, onChange, className, ...props }: CheckboxProps) {
  return <label className={className ? `checkbox ${className}` : "checkbox"}>
    <input {...props} type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
    <span className="checkbox-box" aria-hidden="true">{checked ? <Icon name="check" /> : null}</span>
    <span className="checkbox-label">{label}</span>
  </label>;
}
