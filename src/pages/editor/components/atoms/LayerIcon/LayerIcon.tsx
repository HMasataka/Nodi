import type { DocumentNode } from "@/document/types";
import { Icon, type IconName } from "@/pages/editor/components/atoms/Icon";

const layerIcons: Record<DocumentNode["type"], IconName> = {
  frame: "frame",
  rectangle: "rectangle",
  ellipse: "ellipse",
  path: "pen",
  text: "text",
  image: "image",
  instance: "component",
};

export function LayerIcon({ type }: { type: DocumentNode["type"] }) {
  return <Icon name={layerIcons[type]} className="layer-icon" />;
}
