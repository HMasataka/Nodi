/** インスタンスのオーバーライドのキーで、入れ子のインスタンスの子を指すときの区切り。要素の ID には使えない。 */
export const OVERRIDE_PATH_SEPARATOR = "/";

// 保存形式（省略あり）と内部モデルの両方で使えるよう、たどるのに要る項目だけを見る。
interface PathNode { id: string; type: string }

function findInTree<N extends PathNode>(node: N, id: string): N | undefined {
  if (node.id === id) return node;
  if (node.type !== "frame") return undefined;
  for (const child of (node as unknown as { children: N[] }).children) {
    const found = findInTree(child, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * オーバーライドのキー（`子のID` または `入れ子のインスタンスID/子のID/…`）が指す要素を、定義のツリーから探す。
 * 途中の段はインスタンスでなければならず、次の段はそのインスタンスの定義の中から探す。見つからなければ undefined。
 */
export function overrideTarget<N extends PathNode>(root: N, key: string, definitionOf: (componentRef: string) => N | undefined): N | undefined {
  let scope: N | undefined = root;
  let target: N | undefined;
  for (const segment of key.split(OVERRIDE_PATH_SEPARATOR)) {
    if (!scope || segment === "") return undefined;
    target = findInTree(scope, segment);
    if (!target) return undefined;
    scope = target.type === "instance" ? definitionOf((target as unknown as { componentRef: string }).componentRef) : undefined;
  }
  return target;
}

/** 外側のオーバーライドのうち、入れ子のインスタンス `instanceId` の中を指すものを、そのインスタンスから見たキーに直して返す。 */
export function scopedOverrides<T>(overrides: Record<string, T>, instanceId: string): Record<string, T> {
  const prefix = instanceId + OVERRIDE_PATH_SEPARATOR;
  return Object.fromEntries(Object.entries(overrides).flatMap(([key, value]) => key.startsWith(prefix) ? [[key.slice(prefix.length), value]] : []));
}
