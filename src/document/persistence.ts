import { Result } from "@praha/byethrow";
import { parseDocument, serializeDocument } from "./format.ts";
import type { Document } from "./types.ts";

export interface DocumentFileAccess {
  pickOpen(): Promise<string | null>;
  pickSave(defaultPath?: string): Promise<string | null>;
  read(path: string): Promise<string>;
  write(path: string, contents: string): Promise<void>;
}

export interface OpenedDocument {
  path: string;
  document: Document;
}

function fileError(action: string, error: unknown): Error {
  return new Error(`${action}: ${error instanceof Error ? error.message : String(error)}`);
}

function documentError(error: Error | readonly { message: string; path?: readonly unknown[] }[]): Error {
  if (error instanceof Error) return error;
  return new Error(error.map((issue) => {
    const path = issue.path?.map((segment) =>
      typeof segment === "object" && segment !== null && "key" in segment
        ? String(segment.key)
        : String(segment),
    ).join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  }).join("\n"));
}

export async function openDocumentFile(
  access: DocumentFileAccess,
): Promise<Result.Result<OpenedDocument | null, Error>> {
  const chosen = await Result.fn({
    try: () => access.pickOpen(),
    catch: (error) => fileError("ファイルを選択できません", error),
  })();
  if (Result.isFailure(chosen)) return chosen;
  const path = chosen.value;
  if (path === null) return Result.succeed(null);

  const contents = await Result.fn({
    try: () => access.read(path),
    catch: (error) => fileError("ファイルを読み込めません", error),
  })();
  if (Result.isFailure(contents)) return contents;

  const parsed = parseDocument(contents.value);
  if (Result.isFailure(parsed)) return Result.fail(documentError(parsed.error));
  return Result.succeed({ path, document: parsed.value });
}

export async function saveDocumentFile(
  access: DocumentFileAccess,
  document: Document,
  currentPath: string | null,
): Promise<Result.Result<string | null, Error>> {
  const serialized = serializeDocument(document);
  if (Result.isFailure(serialized)) return Result.fail(documentError(serialized.error));

  let path = currentPath;
  if (path === null) {
    const chosen = await Result.fn({
      try: () => access.pickSave("untitled.nodi"),
      catch: (error) => fileError("保存先を選択できません", error),
    })();
    if (Result.isFailure(chosen)) return chosen;
    path = chosen.value;
  }
  if (path === null) return Result.succeed(null);

  const written = await Result.fn({
    try: () => access.write(path, serialized.value),
    catch: (error) => fileError("ファイルを保存できません", error),
  })();
  if (Result.isFailure(written)) return written;
  return Result.succeed(path);
}
