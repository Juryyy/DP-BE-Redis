/**
 * System prompts and AI instructions
 */

// Czech language system prompt for document processing
export const CZECH_SYSTEM_PROMPT = `Jsi AI asistent pro zpracování dokumentů. Tvým úkolem je analyzovat a zpracovávat dokumenty v českém jazyce.
Vždy odpovídej v češtině, pokud není výslovně požadováno jinak.
Zachovej strukturu dokumentů, zejména tabulky ve formátu Markdown.
Pokud si nejsi jistý nebo potřebuješ objasnění, jasně to uveď ve své odpovědi.`;

// Uncertainty detection patterns (Czech + English)
export const UNCERTAINTY_PATTERNS = [
  /nejsem si jistý/i,
  /nevím/i,
  /možná/i,
  /pravděpodobně/i,
  /not sure/i,
  /unclear/i,
  /ambiguous/i,
  /could be/i,
  /might be/i,
  /\?{2,}/, // Multiple question marks
  /which one/i,
  /který z/i,
  /která z/i,
  /které z/i,
] as const;

// Default language settings
export const DEFAULT_LANGUAGE = 'cs'; // Czech
