// Lightweight language guess for the last-resort region signal (report Table 4, signal 5, confidence 0.40).
// Non-Latin scripts are identified by Unicode script; Latin-script text by common function words.
// Returns null rather than guessing when the text is too short or ambiguous.

const SCRIPTS: [RegExp, string][] = [
  [/\p{Script=Hangul}/gu, "ko"],
  [/[\p{Script=Hiragana}\p{Script=Katakana}]/gu, "ja"],
  [/\p{Script=Han}/gu, "zh"],
  [/\p{Script=Cyrillic}/gu, "ru"],
  [/\p{Script=Arabic}/gu, "ar"],
  [/\p{Script=Hebrew}/gu, "he"],
  [/\p{Script=Thai}/gu, "th"],
  [/\p{Script=Greek}/gu, "el"],
  [/\p{Script=Devanagari}/gu, "hi"],
];

// Kept to words that are frequent and reasonably distinctive for each language.
const FUNCTION_WORDS: Record<string, string[]> = {
  en: ["the", "and", "is", "are", "this", "that", "you", "it", "of", "was", "with", "for", "have", "just", "what", "they", "but", "not", "my", "i'm", "don't", "can't"],
  es: ["el", "los", "las", "que", "es", "y", "del", "una", "por", "para", "pero", "muy", "juego", "más", "mas", "está", "esta", "como", "porque", "también"],
  pt: ["os", "que", "é", "não", "nao", "uma", "com", "para", "mais", "jogo", "você", "voce", "muito", "está", "isso", "também", "ele", "ela"],
  fr: ["le", "les", "et", "est", "une", "des", "pas", "qui", "pour", "avec", "ce", "jeu", "je", "c'est", "mais", "très", "tres", "sur"],
  de: ["der", "die", "das", "und", "ist", "nicht", "ein", "eine", "ich", "mit", "auf", "spiel", "auch", "sehr", "aber", "wie"],
  it: ["il", "che", "è", "di", "non", "gioco", "sono", "molto", "per", "questo", "anche", "della", "ma", "come"],
};

const DIACRITIC_HINTS: [RegExp, string][] = [
  [/[ñ¿¡]/u, "es"],
  [/[ãõ]/u, "pt"],
  [/[ß]/u, "de"],
];

const MIN_LETTERS = 12;
const MIN_WORD_HITS = 2;

export function detectLanguage(text: string): string | null {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters < MIN_LETTERS) return null;

  // A non-Latin script covering a meaningful share of the letters decides it outright.
  // Kana is checked before Han so Japanese (which also uses Han) isn't read as Chinese.
  for (const [pattern, code] of SCRIPTS) {
    const hits = text.match(pattern)?.length ?? 0;
    if (hits / letters >= 0.3) return code;
  }

  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  const scores = new Map<string, number>();
  for (const [code, list] of Object.entries(FUNCTION_WORDS)) {
    const vocab = new Set(list);
    scores.set(code, words.filter((w) => vocab.has(w)).length);
  }
  for (const [pattern, code] of DIACRITIC_HINTS) {
    if (pattern.test(text)) scores.set(code, (scores.get(code) ?? 0) + 1);
  }

  const ranked = [...scores].sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] < MIN_WORD_HITS || best[1] === second?.[1]) return null;
  return best[0];
}
