import type { ContentFactsIndex } from '../../src/ContentFacts';
import { matchLink } from '../../src/matchers/LinkMatcher';

function makeIndex(overrides: Partial<ContentFactsIndex> = {}): ContentFactsIndex {
  return { headings: [], links: [], images: [], tables: [], ...overrides };
}

function anchor(html: string): HTMLAnchorElement {
  const el = document.createElement('a');
  el.innerHTML = html;
  return el;
}

describe('matchLink', () => {
  it('matches by the anchor own visible text against known heading text', () => {
    const el = anchor('Tset');
    const index = makeIndex({ headings: [{ text: 'Tset', contentElementUid: 51 }] });
    expect(matchLink(el, index)).toEqual({ contentElementUid: 51, hasAltData: false });
  });

  it('matches by aria-label against known link text', () => {
    const el = anchor('');
    el.setAttribute('aria-label', 'Read more');
    const index = makeIndex({ links: [{ text: 'Read more', href: '/camino', contentElementUid: 52 }] });
    expect(matchLink(el, index)).toEqual({ contentElementUid: 52, hasAltData: false });
  });

  it('matches by href against a known link', () => {
    const el = anchor('');
    el.setAttribute('href', '/camino');
    const index = makeIndex({ links: [{ text: 'Read more', href: '/camino', contentElementUid: 52 }] });
    expect(matchLink(el, index)).toEqual({ contentElementUid: 52, hasAltData: false });
  });

  it('delegates to image matching when the anchor wraps an img', () => {
    const el = anchor('<img src="/fileadmin/photo.webp">');
    const index = makeIndex({ images: [{ hasAltData: true, matchers: ['photo.webp'], contentElementUid: 38 }] });
    expect(matchLink(el, index)).toEqual({ contentElementUid: 38, hasAltData: true });
  });

  it('returns undefined when nothing correlates (e.g. a template-rendered logo link)', () => {
    const el = anchor('');
    el.setAttribute('href', '/');
    el.className = 'header__logo';
    const index = makeIndex();
    expect(matchLink(el, index)).toBeUndefined();
  });
});
