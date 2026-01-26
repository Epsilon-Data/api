You must respond with **valid JSON** matching this TypeScript interface:

```ts
interface GraphPayload {
  nodes: { id: string; label: string; depth: number }[];
  edges: { source: string; target: string }[];
}
```

**CRITICAL REQUIREMENTS:**

- You **MUST** include both `nodes` and `edges` arrays in your response
- `edges` array **CANNOT** be empty - you must create edges for the hierarchy
- The root node has `depth: 0`.
- Children of the root have `depth: 1`.
- Children of any node will have `depth: parent[depth] + 1`
  - For example, nodes with `depth: 2` will have a parent of `depth: 1` and children with `depth: 3`
- Each edge represents a parent-child relationship where `source` is the parent ID and `target` is the child ID. Every non-root node must have exactly one incoming edge from its parent.
- Do **not** wrap the JSON in markdown fences.
