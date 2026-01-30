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
- For all nodes, you **MUST** differentiate between the `id` and `label` where the `id` should be kept the same from the variable name in the codebook, while the label **MUST** be a cleaned version of the `id`, where if it is using `camelCase`, change it to `Camel Case`, or `snake_case` into `Snake Case`. Essentially, remove all underscores and replace with space, capitalize the first letter of every word, and add spaces between words where underscores are not present such as in `camelCase` and `PascalCase`. If any numbers are present within the `id` such as `income_1` and `income_2`, keep the number so it becomes `Income 1` and `Income 2`. Ensure **ALL** variables from the codebook are still present.
- Do **not** wrap the JSON in markdown fences.
