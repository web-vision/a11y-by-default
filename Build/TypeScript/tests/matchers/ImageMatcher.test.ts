import type { ContentFactsIndex } from '../../src/ContentFacts';
import { matchImageSource } from '../../src/matchers/ImageMatcher';

function makeIndex(images: ContentFactsIndex['images']): ContentFactsIndex {
  return { headings: [], links: [], images, tables: [] };
}

describe('matchImageSource', () => {
  it('matches when the rendered src contains a known processed-file matcher', () => {
    const index = makeIndex([
      { hasAltData: false, matchers: ['csm_max-kukurudziak_e169eb3b6d.webp'], contentElementUid: 38 },
    ]);
    const src = '/fileadmin/_processed_/0/2/csm_max-kukurudziak_e169eb3b6d.webp';
    expect(matchImageSource(src, index)).toEqual({ contentElementUid: 38, hasAltData: false });
  });

  it('reports hasAltData true when the matched image has alt data in the database', () => {
    const index = makeIndex([{ hasAltData: true, matchers: ['photo.webp'], contentElementUid: 38 }]);
    expect(matchImageSource('/fileadmin/photo.webp', index)).toEqual({ contentElementUid: 38, hasAltData: true });
  });

  it('returns undefined when no matcher is contained in the source', () => {
    const index = makeIndex([{ hasAltData: false, matchers: ['photo.webp'], contentElementUid: 38 }]);
    expect(matchImageSource('/typo3conf/ext/theme/Icons/logo.svg', index)).toBeUndefined();
  });

  it('returns undefined for a blank source', () => {
    const index = makeIndex([{ hasAltData: false, matchers: ['photo.webp'], contentElementUid: 38 }]);
    expect(matchImageSource('  ', index)).toBeUndefined();
  });
});
