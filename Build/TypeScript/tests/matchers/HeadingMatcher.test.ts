import type { ContentFactsIndex } from '../../src/ContentFacts';
import { matchHeadingText } from '../../src/matchers/HeadingMatcher';

function makeIndex(headings: ContentFactsIndex['headings']): ContentFactsIndex {
  return { headings, links: [], images: [], tables: [] };
}

describe('matchHeadingText', () => {
  it('matches an exact heading text to its owning content element', () => {
    const index = makeIndex([{ text: 'Heeeheeeeeheee', contentElementUid: 52 }]);
    expect(matchHeadingText('Heeeheeeeeheee', index)).toBe(52);
  });

  it('matches regardless of surrounding whitespace and case', () => {
    const index = makeIndex([{ text: 'Tset', contentElementUid: 51 }]);
    expect(matchHeadingText('  tset  ', index)).toBe(51);
  });

  it('returns undefined when no heading text matches', () => {
    const index = makeIndex([{ text: 'Tset', contentElementUid: 51 }]);
    expect(matchHeadingText('Camino', index)).toBeUndefined();
  });

  it('returns undefined for blank input', () => {
    const index = makeIndex([{ text: 'Tset', contentElementUid: 51 }]);
    expect(matchHeadingText('   ', index)).toBeUndefined();
  });
});
