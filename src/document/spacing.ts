import type { Document, DocumentNode, FrameNode } from "@/document/types.ts";

export function resolvedSpacing(document: Document, frame: FrameNode, key: "padding" | "gap"): number {
  const ref = key === "padding" ? frame.paddingRef : frame.gapRef;
  return ref === undefined ? frame[key] : document.spacing.find((token) => token.id === ref)?.value ?? frame[key];
}

// The layout engine receives a transient document with concrete values. The source document
// retains stable references so editor, PNG and MCP read the same definition after a rename.
export function resolveDocumentSpacing(document: Document): Document {
  function resolve(node: DocumentNode): DocumentNode {
    if (node.type !== "frame") return node;
    return { ...node, padding: resolvedSpacing(document, node, "padding"), gap: resolvedSpacing(document, node, "gap"),
      children: node.children.map(resolve) };
  }
  return { ...document, children: document.children.map(resolve) };
}
