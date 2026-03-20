/**
 * Strips HTML/XML tags and backticks from user-supplied strings.
 *
 * Defense-in-depth against prompt injection: tags are removed so user text
 * cannot escape the XML delimiters used in prompt templates; backticks are
 * replaced with single quotes so they cannot break template-literal-style
 * formatting in system instructions.
 */
export const sanitize = (s: string): string =>
  s.replace(/<[^>]*>/g, '').replace(/`/g, "'").trim();
