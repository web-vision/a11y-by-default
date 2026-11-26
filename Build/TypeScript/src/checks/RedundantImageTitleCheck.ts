import { normalizeText, type ContentFactsIndex } from '../ContentFacts';
import { matchImageSource } from '../matchers/ImageMatcher';
import type { AccessibilityIssue, IssueNode } from '../types';

export const REDUNDANT_IMG_TITLE_RULE_ID = 'a11y-redundant-img-title';

export type LabelResolver = (key: string) => string;

/**
 * Own check (neither axe-core nor HTML CodeSniffer ships such a rule): an image whose title attribute merely
 * repeats the alt text makes screen readers announce the same text twice.
 *
 * One issue is emitted per offending image so each gets its own classification and edit link.
 * ViolationClassifier sends a matched node with dataAvailable !== true to the editor, hence:
 * database values identical (altEqualsTitle) -> dataAvailable false -> editor;
 * database values fine but output redundant (template copies alt to title) -> dataAvailable true -> developer;
 * unmatched image -> no content element -> developer.
 */
export class RedundantImageTitleCheck {
  constructor(private readonly resolveLabel: LabelResolver) {}

  run(document: Document, index: ContentFactsIndex): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    document.querySelectorAll('img[alt][title]').forEach((img) => {
      const alt = normalizeText(img.getAttribute('alt') ?? '');
      if (alt === '' || alt !== normalizeText(img.getAttribute('title') ?? '')) {
        return;
      }

      const node: IssueNode = { html: img.outerHTML, target: [this.buildSelector(img)] };
      const match = matchImageSource(img.getAttribute('src') ?? '', index);
      if (match !== undefined) {
        node.contentElementUid = match.contentElementUid;
        node.dataAvailable = !match.altEqualsTitle;
      }

      issues.push({
        id: REDUNDANT_IMG_TITLE_RULE_ID,
        impact: 'minor',
        description: this.resolveLabel(`rule.${REDUNDANT_IMG_TITLE_RULE_ID}.description`),
        help: this.resolveLabel(`rule.${REDUNDANT_IMG_TITLE_RULE_ID}.help`),
        helpUrl: 'https://www.w3.org/WAI/tutorials/images/',
        tags: ['best-practice'],
        nodes: [node],
      });
    });

    return issues;
  }

  private buildSelector(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;
    while (current !== null && current.parentElement !== null) {
      const tag = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentElement.children);
      parts.unshift(`${tag}:nth-child(${siblings.indexOf(current) + 1})`);
      current = current.parentElement;
    }
    return ['html', ...parts].join(' > ');
  }
}
