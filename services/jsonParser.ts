/**
 * Attempts to parse a JSON value of type T from a string that may contain:
 * - pure JSON
 * - markdown fenced code blocks (```json ... ``` or ``` ... ```)
 * - JSON embedded in surrounding prose
 *
 * Returns `null` if no valid JSON can be extracted or parsed.
 */
export const parseJsonFromText = <T,>(text: string): T | null => {
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  // Try to extract JSON object or array from surrounding text
  const jsonBlockMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1];
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    try {
      return JSON.parse(text.trim()) as T;
    } catch {
      return null;
    }
  }
};
