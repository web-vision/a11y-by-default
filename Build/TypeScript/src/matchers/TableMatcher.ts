import { normalizeText, type ContentFactsIndex } from '../ContentFacts';

const OVERLAP_THRESHOLD = 0.6;

function getLiveCellTexts(table: Element): string[] {
  return Array.from(table.querySelectorAll('td, th'))
    .map((cell) => normalizeText(cell.textContent ?? ''))
    .filter((text) => text !== '');
}

function overlapRatio(liveCellTexts: string[], knownCellTexts: string[]): number {
  if (liveCellTexts.length === 0) {
    return 0;
  }

  const known = new Set(knownCellTexts.map((text) => normalizeText(text)));
  const overlapping = liveCellTexts.filter((text) => known.has(text)).length;
  return overlapping / liveCellTexts.length;
}

export function matchTable(table: Element, index: ContentFactsIndex): number | undefined {
  const liveCellTexts = getLiveCellTexts(table);
  if (liveCellTexts.length === 0) {
    return undefined;
  }

  let bestUid: number | undefined;
  let bestRatio = OVERLAP_THRESHOLD;
  for (const fact of index.tables) {
    const ratio = overlapRatio(liveCellTexts, fact.cellTexts);
    if (ratio >= bestRatio) {
      bestRatio = ratio;
      bestUid = fact.contentElementUid;
    }
  }

  return bestUid;
}
