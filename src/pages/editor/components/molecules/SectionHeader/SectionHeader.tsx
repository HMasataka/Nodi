import { IconButton } from "@/pages/editor/components/atoms/IconButton";

export type SectionHeaderAction = {
  // add は一つだけ持てる節の未設定と複数持てる節、remove は設定済みの節に使う。
  kind: "add" | "remove";
  label: string;
  onClick(): void;
  disabled?: boolean;
};

type SectionHeaderProps = {
  title: string;
  // 省略すると、常にある節として記号を出さない。
  action?: SectionHeaderAction;
  id?: string;
};

// プロパティやアセットの節の見出し。右端に＋か−の操作を置く。
export function SectionHeader({ title, action, id }: SectionHeaderProps) {
  return <div className="section-header">
    <h3 id={id} className="section-header-title">{title}</h3>
    {action ? <IconButton icon={action.kind === "add" ? "plus" : "minus"} label={action.label} className="section-header-action"
      disabled={action.disabled} onClick={action.onClick} /> : null}
  </div>;
}
