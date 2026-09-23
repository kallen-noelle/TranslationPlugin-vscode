/**
 * Core data types for the translation plugin.
 */
/** A dictionary entry returned by Google / Microsoft. */
export interface DictItem {
  /** Part of speech tag, e.g. "noun", "verb". */
  pos?: string;
  /** The dictionary term (headword). */
  term?: string;
  /** List of translations with back-translations. */
  entries?: { translation: string; backTranslations: string[] }[];
}

/**
 * 一条双语例句（来自微软 texamplev3 端点）。
 * source/target 六段拆分是为了在 UI 中给关键词加粗高亮。
 */
export interface ExampleItem {
  sourcePrefix: string;
  sourceTerm: string;
  sourceSuffix: string;
  targetPrefix: string;
  targetTerm: string;
  targetSuffix: string;
}

/** Result of a translation request. */
export interface Translation {
  original: string;
  translation: string | null;
  /** Source language code (resolved, may differ from requested when auto). */
  srcLang: string;
  targetLang: string;
  /** Candidate source languages (auto-detection). */
  sourceLanguages: string[];
  /** Transliteration of the original text. */
  srcTransliteration?: string | null;
  /** Transliteration of the translation. */
  transliteration?: string | null;
  /** Dictionary entries. */
  dict?: DictItem[];
  /** Example sentences (bilingual). */
  examples?: ExampleItem[];
  /** Spell-corrected original text (from Bing spellcheck), if any. */
  spelling?: string | null;
}

/** A translation engine. */
export interface Translator {
  readonly id: string;
  readonly name: string;
  /** Whether this engine supports automatic source-language detection. */
  readonly supportsAuto: boolean;
  readonly supportedSourceLanguages: string[];
  readonly supportedTargetLanguages: string[];
  translate(text: string, srcLang: string, targetLang: string): Promise<Translation>;
}

/** Error thrown when a translation engine reports an error. */
export class TranslationError extends Error {
  constructor(
    message: string,
    readonly engineId?: string,
    readonly engineName?: string,
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}

/** Supported word-extraction modes, mirroring the IntelliJ plugin. */
export const enum ExtractMode {
  /** Use selection if present, otherwise extract words from a range around the caret. */
  Auto = 'auto',
  /** Ignore selection; extract the full range (all words in the line/statement). */
  Inclusive = 'inclusive',
  /** Ignore selection; extract only the nearest single word. */
  Exclusive = 'exclusive',
}