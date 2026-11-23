import type { ButtonHTMLAttributes } from "react";

import { Icon, type IconName } from "@/pages/editor/components/atoms/Icon";

type IconButtonProps = {
  icon: IconName;
  label: string;
  pressed?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "aria-pressed">;

// 32px 角のアイコンボタン。pressed を渡したときだけ切り換えボタンとして aria-pressed を出す。
export function IconButton({ icon, label, pressed, className, type = "button", ...props }: IconButtonProps) {
  return <button {...props} type={type} className={className ? `icon-button ${className}` : "icon-button"}
    aria-label={label} title={props.title ?? label} aria-pressed={pressed}>
    <Icon name={icon} />
  </button>;
}
