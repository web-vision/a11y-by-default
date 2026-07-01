import { normalizeText, type ContentFactsIndex } from '../ContentFacts';

export function matchHeadingText(text: string, index: ContentFactsIndex): number | undefined {
  const normalized = normalizeText(text);
  if (normalized === '') {
    return undefined;
  }

  const match = index.headings.find((heading) => normalizeText(heading.text) === normalized);
  return match?.contentElementUid;
}
