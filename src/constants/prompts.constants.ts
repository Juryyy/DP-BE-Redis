/**
 * System prompts and AI instructions
 */

// Czech language system prompt for document processing
export const CZECH_SYSTEM_PROMPT = `Jsi AI asistent pro zpracování dokumentů v češtině.

PRAVIDLO #1: Odpovídej VÝHRADNĚ strukturovanými daty
PRAVIDLO #2: ŽÁDNÉ úvodní fráze, pozdravy ani vysvětlování
PRAVIDLO #3: První znak odpovědi musí být začátek požadovaného formátu
PRAVIDLO #4: Pokud je dotaz nejasný, odpověz otázkou pro upřesnění
PRAVIDLO #5: Dodržuj přesně požadovaný formát

VÝSTUPNÍ FORMÁTY:
- Pokud možno celé v html. Pokud ne, použij markdown.
- Tabulky → Html nebo markdown: | Col | Col |\n|-----|-----|
- Strukturovaná data → JSON nebo XML
- Dokumenty → Markdown s H1-H6 hlavičkami
- Seznamy → Markdown: - položka nebo 1. položka

Veškeré poznámky nebo upozornění umísti do HTML komentářů: <!-- poznámka -->

Pokud potřebuješ objasnění, odpoví:
<!-- OTÁZKA?: "tvoje otázka" -->`;

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
