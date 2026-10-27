import type { GraphNode, PermissionRule } from "../src/domain.ts"

export const node = (id: string, mode: GraphNode["mode"], permissions: readonly PermissionRule[] = []): GraphNode => ({
  id,
  name: id,
  mode,
  hidden: false,
  permissions,
})
