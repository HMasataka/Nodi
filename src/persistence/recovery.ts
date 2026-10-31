import { Result } from "@praha/byethrow";
import { z } from "zod";
import { parseDocument, serializeDocument } from "@/persistence/format.ts";
import type { Document } from "@/document/types.ts";

export interface RecoveryFileAccess {
  read(): Promise<string | null>;
  write(contents: string): Promise<void>;
  clear(): Promise<void>;
}

export interface RecoveryDraft {
  sourcePath: string | null;
  document: Document;
}

const recoverySchema = z.strictObject({ version: z.literal(1), sourcePath: z.string().nullable(), contents: z.string() });

function failure(error: Error | readonly { message: string }[]): Error {
  return error instanceof Error ? error : new Error(error.map((issue) => issue.message).join("\n"));
}

export async function readRecoveryDraft(access: RecoveryFileAccess): Promise<Result.Result<RecoveryDraft | null, Error>> {
  const read = await Result.fn({ try: () => access.read(), catch: (error) => new Error(`復元データを読み込めません: ${String(error)}`) })();
  if (Result.isFailure(read)) return read;
  if (read.value === null) return Result.succeed(null);
  const contents = read.value;
  const json = Result.fn({ try: () => JSON.parse(contents) as unknown, catch: () => new Error("復元データの JSON が壊れています") })();
  if (Result.isFailure(json)) return json;
  const envelope = Result.parse(recoverySchema, json.value);
  if (Result.isFailure(envelope)) return Result.fail(failure(envelope.error));
  const document = parseDocument(envelope.value.contents);
  if (Result.isFailure(document)) return Result.fail(failure(document.error));
  return Result.succeed({ sourcePath: envelope.value.sourcePath, document: document.value });
}

export async function writeRecoveryDraft(access: RecoveryFileAccess, draft: RecoveryDraft): Promise<Result.Result<void, Error>> {
  const serialized = serializeDocument(draft.document);
  if (Result.isFailure(serialized)) return Result.fail(failure(serialized.error));
  return Result.fn({
    try: () => access.write(JSON.stringify({ version: 1, sourcePath: draft.sourcePath, contents: serialized.value })),
    catch: (error) => new Error(`復元データを保存できません: ${String(error)}`),
  })();
}

export async function clearRecoveryDraft(access: RecoveryFileAccess): Promise<Result.Result<void, Error>> {
  return Result.fn({ try: () => access.clear(), catch: (error) => new Error(`復元データを破棄できません: ${String(error)}`) })();
}
