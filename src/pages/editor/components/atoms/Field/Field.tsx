import { type InputHTMLAttributes, type KeyboardEvent, useId, useState } from "react";

// Enter で確定する入力に共通の振る舞い。blur させて onBlur 側の確定処理に流す。
export function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur();
}

type FieldProps = {
  label: string;
  value: string;
  onCommit(value: string): void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "onBlur" | "onKeyDown" | "id">;

// 28px 高で左にラベルを持つ入力欄。入力中は下書きを持ち、blur か Enter で値が変わっていれば確定する。
export function Field({ label, value, onCommit, className, ...props }: FieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setDraft(value);
  }
  return <div className={className ? `field ${className}` : "field"}>
    <label className="field-label-text" htmlFor={id}>{label}</label>
    <input {...props} id={id} value={draft} spellCheck={props.spellCheck ?? false}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
        // 確定しなかった（親が値を変えなかった）ときは元の値に戻す。変えたときは次の描画で新しい値に置き換わる。
        setDraft(value);
      }}
      onKeyDown={blurOnEnter} />
  </div>;
}
