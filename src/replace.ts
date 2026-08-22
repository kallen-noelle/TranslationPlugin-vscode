/**
 * Formatting of translated text for the "Replace with Translation" action.
 */

export type NamingStyle = 'camelCase' | 'snake_case' | 'PascalCase' | 'kebab-case' | 'original';

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function toWords(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Formats [translation] according to the requested naming [style].
 */
export function formatTranslation(translation: string, style: string): string {
  const words = toWords(translation);
  if (words.length === 0) {
    return translation;
  }

  switch (style) {
    case 'camelCase':
      return words
        .map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w.toLowerCase())))
        .join('');
    case 'PascalCase':
      return words.map((w) => capitalize(w.toLowerCase())).join('');
    case 'snake_case':
      return words.map((w) => w.toLowerCase()).join('_');
    case 'kebab-case':
      return words.map((w) => w.toLowerCase()).join('-');
    case 'original':
    default:
      return translation;
  }
}
