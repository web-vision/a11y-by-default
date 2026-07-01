import { buildContentFactsIndex, normalizeText } from '../src/ContentFacts';
import type { ContentFacts } from '../src/types';

describe('normalizeText', () => {
  it('trims, collapses whitespace, and lower-cases', () => {
    expect(normalizeText('  Heeeheeeeeheee  \n')).toBe('heeeheeeeeheee');
    expect(normalizeText('Multi   word\ttext')).toBe('multi word text');
  });
});

describe('buildContentFactsIndex', () => {
  const facts: ContentFacts = {
    51: { headings: [{ text: 'Tset', level: 1 }], links: [], images: [], tables: [] },
    52: {
      headings: [{ text: 'Heeeheeeeeheee', level: 3 }],
      links: [{ text: 'Read more', href: '/camino' }],
      images: [{ hasAltData: false, matchers: ['photo.webp'] }],
      tables: [{ cellTexts: ['Name', 'Age'] }],
    },
  };

  it('flattens headings with their owning content element uid', () => {
    const index = buildContentFactsIndex(facts);
    expect(index.headings).toEqual([
      { text: 'Tset', contentElementUid: 51 },
      { text: 'Heeeheeeeeheee', contentElementUid: 52 },
    ]);
  });

  it('flattens links, images, and tables with their owning content element uid', () => {
    const index = buildContentFactsIndex(facts);
    expect(index.links).toEqual([{ text: 'Read more', href: '/camino', contentElementUid: 52 }]);
    expect(index.images).toEqual([{ hasAltData: false, matchers: ['photo.webp'], contentElementUid: 52 }]);
    expect(index.tables).toEqual([{ cellTexts: ['Name', 'Age'], contentElementUid: 52 }]);
  });

  it('returns empty arrays for an empty facts object', () => {
    const index = buildContentFactsIndex({});
    expect(index).toEqual({ headings: [], links: [], images: [], tables: [] });
  });
});
