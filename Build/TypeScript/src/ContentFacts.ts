import type { ContentFacts, ImageFact, TableFact } from './types';

export interface HeadingIndexEntry {
  text: string;
  contentElementUid: number;
}

export interface LinkIndexEntry {
  text: string;
  href: string;
  contentElementUid: number;
}

export interface ImageIndexEntry extends ImageFact {
  contentElementUid: number;
}

export interface TableIndexEntry extends TableFact {
  contentElementUid: number;
}

export interface ContentFactsIndex {
  headings: HeadingIndexEntry[];
  links: LinkIndexEntry[];
  images: ImageIndexEntry[];
  tables: TableIndexEntry[];
}

export const EMPTY_CONTENT_FACTS_INDEX: ContentFactsIndex = { headings: [], links: [], images: [], tables: [] };

export function buildContentFactsIndex(facts: ContentFacts): ContentFactsIndex {
  const index: ContentFactsIndex = { headings: [], links: [], images: [], tables: [] };

  for (const [uidKey, elementFacts] of Object.entries(facts)) {
    const contentElementUid = Number(uidKey);
    elementFacts.headings.forEach((heading) => index.headings.push({ text: heading.text, contentElementUid }));
    elementFacts.links.forEach((link) => index.links.push({ text: link.text, href: link.href, contentElementUid }));
    elementFacts.images.forEach((image) => index.images.push({ ...image, contentElementUid }));
    elementFacts.tables.forEach((table) => index.tables.push({ ...table, contentElementUid }));
  }

  return index;
}

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
