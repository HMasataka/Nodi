import { type SelectHTMLAttributes, useId } from "react";

import { Icon } from "@/pages/editor/components/atoms/Icon";

type SelectFieldProps<T extends string> = {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(value: T): void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "onChange" | "id" | "children">;

// 入力欄と同じ形で、右端に下向きの矢印を置く選択式の入力欄。
export function SelectField<T extends string>({ label, value, options, onChange, className, ...props }: SelectFieldProps<T>) {
  const id = useId();
  return <div className={className ? `field select-field ${className}` : "field select-field"}>
    <label className="field-label-text" htmlFor={id}>{label}</label>
    <select {...props} id={id} value={value} onChange={(event) => onChange(event.currentTarget.value as T)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <Icon name="chevronDown" className="select-field-arrow" />
  </div>;
}
