export function buildPrompt(params: {
  headings?: string[];
  context?: string;
  encodedFile?: string;
}): string {
  const { headings = [], context, encodedFile } = params;

  const headingsText = `Headings:\n${headings.map((h) => `- ${h}`).join('\n')}`;

  const res = [
    headingsText,
    encodedFile ? `\nBase64 encoded file:\n${encodedFile}` : '',
    context ? `\nAdditional context:\n${context}` : '',
    '\n\nReturn ONLY valid JSON.',
  ].join('');

  return res;
}
