import type { ContentFactsIndex } from '../ContentFacts';
import { matchHeadingText } from './HeadingMatcher';
import { matchImageSource } from './ImageMatcher';
import { matchLink } from './LinkMatcher';
import { matchTable } from './TableMatcher';

export interface ContentMatchResult {
  contentElementUid?: number;
  dataAvailable?: boolean;
}

const HEADING_RULES = new Set(['heading-order']);
const IMAGE_RULES = new Set(['image-alt', 'input-image-alt', 'area-alt']);
const LINK_RULES = new Set(['link-name']);
const TABLE_RULES = new Set(['td-headers-attr', 'th-has-data-cells']);

function resolveHeadingMatch(element: Element, index: ContentFactsIndex): ContentMatchResult {
  const uid = matchHeadingText(element.textContent ?? '', index);
  return uid !== undefined ? { contentElementUid: uid } : {};
}

function resolveImageMatch(ruleId: string, element: Element, index: ContentFactsIndex): ContentMatchResult {
  const attribute = ruleId === 'area-alt' ? 'href' : 'src';
  const match = matchImageSource(element.getAttribute(attribute) ?? '', index);
  return match !== undefined ? { contentElementUid: match.contentElementUid, dataAvailable: match.hasAltData } : {};
}

function resolveLinkMatch(element: Element, index: ContentFactsIndex): ContentMatchResult {
  const match = matchLink(element, index);
  return match !== undefined ? { contentElementUid: match.contentElementUid, dataAvailable: match.hasAltData } : {};
}

function resolveTableMatch(element: Element, index: ContentFactsIndex): ContentMatchResult {
  const table = element.closest('table');
  const uid = table !== null ? matchTable(table, index) : undefined;
  return uid !== undefined ? { contentElementUid: uid } : {};
}

/**
 * Dispatches to the matcher appropriate for the given axe/HTML CodeSniffer rule id, correlating the live
 * offending DOM element against known database content (see ContentFactsService on the PHP side) instead of
 * relying on any particular template's markup conventions.
 */
export function resolveContentMatch(
  ruleId: string,
  element: Element | null,
  index: ContentFactsIndex,
): ContentMatchResult {
  if (element === null) {
    return {};
  }

  if (HEADING_RULES.has(ruleId)) {
    return resolveHeadingMatch(element, index);
  }
  if (IMAGE_RULES.has(ruleId)) {
    return resolveImageMatch(ruleId, element, index);
  }
  if (LINK_RULES.has(ruleId)) {
    return resolveLinkMatch(element, index);
  }
  if (TABLE_RULES.has(ruleId)) {
    return resolveTableMatch(element, index);
  }

  return {};
}
