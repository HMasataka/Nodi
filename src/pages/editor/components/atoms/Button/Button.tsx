import type { ButtonHTMLAttributes } from "react";

type ButtonProps = {
  variant?: "primary" | "secondary";
} & ButtonHTMLAttributes<HTMLButtonElement>;

// 32px 高のボタン。主は紫の地に白い文字、副は白地に枠を付ける。
export function Button({ variant = "secondary", className, type = "button", ...props }: ButtonProps) {
  const classes = ["button", `button-${variant}`, className].filter(Boolean).join(" ");
  return <button {...props} type={type} className={classes} />;
}
