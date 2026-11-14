import { Result } from "@praha/byethrow";

import { importSvgPaths } from "@/document/svgPath.ts";
import { readImageFile } from "@/ipc/imageFiles";
import type { useEditorDocument } from "@/pages/editor/hooks/useEditorDocument";
import { type CreateKind, creationInput, imageCreationInput } from "@/pages/editor/creation";

export function useElementCreation(session: ReturnType<typeof useEditorDocument>) {
  const { agentApi, designRef, selected, setError, setSelectedId } = session;

  function add(input: Parameters<typeof agentApi.add>[0]) {
    const result = agentApi.add(input);
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
  }

  function create(kind: CreateKind) {
    add(creationInput(kind, designRef.current, selected));
  }

  async function importImage(file: File) {
    const imported = await readImageFile(file);
    if (Result.isFailure(imported)) { setError(imported.error.message); return; }
    add(imageCreationInput(designRef.current, selected, file.name, imported.value));
  }

  async function importSvg(file: File) {
    if (!file.name.toLowerCase().endsWith(".svg") || file.size === 0 || file.size > 1_000_000) {
      setError("1MB以下のSVGファイルを選んでください");
      return;
    }
    let source: string;
    try { source = await file.text(); }
    catch { setError("SVGファイルを読み取れません"); return; }
    const parsed = importSvgPaths(source);
    if (Result.isFailure(parsed)) { setError(parsed.error.message); return; }
    const position = creationInput("rectangle", designRef.current, selected);
    const result = agentApi.importSvg({ icon: parsed.value, name: file.name.replace(/\.svg$/i, "") || "アイコン",
      x: position.x, y: position.y, parentId: position.parentId });
    if (Result.isFailure(result)) { setError(result.error.message); return; }
    setSelectedId(result.value.id);
  }

  return { create, importImage, importSvg };
}
