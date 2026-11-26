import type { ContentFactsIndex } from '../ContentFacts';

export interface ImageMatch {
  contentElementUid: number;
  hasAltData: boolean;
  alternative: string;
  title: string;
  fileName: string;
}

export function matchImageSource(srcOrHref: string, index: ContentFactsIndex): ImageMatch | undefined {
  const value = srcOrHref.trim();
  if (value === '') {
    return undefined;
  }

  const match = index.images.find((image) =>
    image.matchers.some((matcher) => matcher !== '' && value.includes(matcher)),
  );
  if (match === undefined) {
    return undefined;
  }

  return {
    contentElementUid: match.contentElementUid,
    hasAltData: match.hasAltData,
    alternative: match.alternative,
    title: match.title,
    fileName: match.fileName,
  };
}
