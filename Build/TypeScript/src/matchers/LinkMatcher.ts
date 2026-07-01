import { normalizeText, type ContentFactsIndex } from '../ContentFacts';
import { matchImageSource, type ImageMatch } from './ImageMatcher';

function matchTextAgainstKnownContent(text: string, index: ContentFactsIndex): number | undefined {
  const normalized = normalizeText(text);
  if (normalized === '') {
    return undefined;
  }

  const headingMatch = index.headings.find((heading) => normalizeText(heading.text) === normalized);
  if (headingMatch !== undefined) {
    return headingMatch.contentElementUid;
  }

  const linkMatch = index.links.find((link) => normalizeText(link.text) === normalized);
  return linkMatch?.contentElementUid;
}

function matchHrefAgainstKnownLinks(href: string, index: ContentFactsIndex): number | undefined {
  const value = href.trim();
  if (value === '') {
    return undefined;
  }

  const match = index.links.find(
    (link) => link.href !== '' && (value.includes(link.href) || link.href.includes(value)),
  );
  return match?.contentElementUid;
}

export function matchLink(anchor: Element, index: ContentFactsIndex): ImageMatch | undefined {
  const text = anchor.textContent ?? '';
  const ariaLabel = anchor.getAttribute('aria-label') ?? '';

  const textMatch = matchTextAgainstKnownContent(text, index) ?? matchTextAgainstKnownContent(ariaLabel, index);
  if (textMatch !== undefined) {
    return { contentElementUid: textMatch, hasAltData: false };
  }

  const hrefMatch = matchHrefAgainstKnownLinks(anchor.getAttribute('href') ?? '', index);
  if (hrefMatch !== undefined) {
    return { contentElementUid: hrefMatch, hasAltData: false };
  }

  const image = anchor.querySelector('img');
  return image !== null ? matchImageSource(image.getAttribute('src') ?? '', index) : undefined;
}
