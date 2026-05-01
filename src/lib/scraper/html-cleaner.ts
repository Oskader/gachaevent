export function cleanHTML(rawHTML: string, maxChars = 12000): string {
  // Remove scripts, styles, SVGs and comments
  let cleaned = rawHTML
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Truncate preserving approximate valid HTML
  if (cleaned.length > maxChars) {
    cleaned = cleaned.substring(0, maxChars) + '...[truncated]'
  }

  return cleaned
}
