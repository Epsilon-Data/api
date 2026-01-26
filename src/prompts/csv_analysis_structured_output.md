You must respond with **valid JSON** matching this TypeScript interface:

```ts
interface CsvAnalysisResult {
  columns: {
    name: string;
    type: 'metric' | 'ordinal' | 'nominal' | 'unknown';
  }[];
  analysis: {
    column: string;
    statistics: {
      name: string;
      value: number | string;
      applicable: boolean;
    }[];
  }[];
  suggestions: string[];
}
```

Requirements:

- **columns**: Array of all column headers with their classified data types
- **analysis**: For each column, specify which statistics are applicable
  - Use `applicable: true` for recommended statistics
  - Use `applicable: false` for statistics that don't make sense for this data type
  - `value` should be the statistic name (e.g., "mean", "median") for applicable ones, or "N/A" for non-applicable
- **suggestions**: Array of 3-5 specific, actionable analysis recommendations
- Include all standard statistics: Mean, Median, Mode, Sum, Standard Deviation, Variance
- Do **not** wrap the JSON in markdown fences.

Example structure:

```json
{
  "columns": [
    { "name": "age", "type": "metric" },
    { "name": "gender", "type": "nominal" }
  ],
  "analysis": [
    {
      "column": "age",
      "statistics": [
        { "name": "Mean", "value": "mean", "applicable": true },
        { "name": "Median", "value": "median", "applicable": true },
        { "name": "Mode", "value": "mode", "applicable": true }
      ]
    }
  ],
  "suggestions": [
    "Analyze age distribution using descriptive statistics",
    "Compare age groups across different categories"
  ]
}
```
