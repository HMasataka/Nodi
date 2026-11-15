import { type FormEvent, useState } from "react";

import type { SpacingToken } from "@/document/types.ts";

interface Props {
  tokens: SpacingToken[];
  usages: Record<string, number>;
  onCreate(name: string, value: number): void;
  onRename(id: string, name: string): void;
  onValue(id: string, value: number): void;
  onRemove(id: string): void;
}

export function SpacingTokenEditor({ tokens, usages, onCreate, onRename, onValue, onRemove }: Props) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("8");
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = Number(value);
    if (!name.trim() || value.trim() === "" || !Number.isFinite(number) || number < 0) return;
    onCreate(name.trim(), number);
    setName("");
  }
  return <section className="spacing-token-panel" aria-label="文書共通の余白値">
    <div className="spacing-token-heading"><span className="field-label">文書共通の余白・間隔</span><span className="spacing-token-count">{tokens.length} values</span></div>
    {tokens.length === 0 && <p className="property-help">共通値を作ると、複数フレームの余白や間隔に同じpx値を適用できます。</p>}
    <div className="spacing-token-list">
      {tokens.map((token) => <div key={token.id} className="spacing-token-row">
        <span className="spacing-token-mark" aria-hidden="true" />
        <label>名前
          <input key={`${token.id}:${token.name}`} aria-label={`${token.name}の名前`} defaultValue={token.name}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            onBlur={(event) => {
              const next = event.currentTarget.value.trim();
              if (next && next !== token.name) onRename(token.id, next);
              else event.currentTarget.value = token.name;
            }} />
        </label>
        <label>px
          <input key={`${token.id}:${token.value}`} aria-label={`${token.name}のpx値`} type="number" min="0" step="any" defaultValue={token.value}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            onBlur={(event) => {
              const raw = event.currentTarget.value.trim();
              const next = Number(raw);
              if (raw && Number.isFinite(next) && next >= 0 && next !== token.value) onValue(token.id, next);
              else event.currentTarget.value = String(token.value);
            }} />
        </label>
        <div className="spacing-token-foot"><span>{usages[token.id] ?? 0} 箇所で使用 · {token.id.slice(0, 11)}</span>
          <button type="button" className="file-button" onClick={() => onRemove(token.id)} aria-label={`${token.name}を削除`}>削除</button>
        </div>
      </div>)}
    </div>
    <form className="spacing-token-create" onSubmit={create}>
      <label>新しい名前<input aria-label="新しい共通値の名前" value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="例：カード内側" /></label>
      <label>px<input aria-label="新しい共通値のpx値" type="number" min="0" step="any" value={value} onChange={(event) => setValue(event.currentTarget.value)} /></label>
      <button type="submit" className="file-button" disabled={!name.trim()}>追加</button>
    </form>
    <p className="property-help">使用中の値を削除すると、参照先は現在のpx値で固定されます。</p>
  </section>;
}
