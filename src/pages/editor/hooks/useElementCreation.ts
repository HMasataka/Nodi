import { Result } from "@praha/byethrow";

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

  return { create, importImage };
}
