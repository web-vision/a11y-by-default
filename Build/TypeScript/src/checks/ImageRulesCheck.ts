import { normalizeText, type ContentFactsIndex } from '../ContentFacts';
import { matchImageSource } from '../matchers/ImageMatcher';
import type { AccessibilityIssue, IssueNode } from '../types';

export const REDUNDANT_IMG_TITLE_RULE_ID = 'a11y-redundant-img-title';
export const MIN_ALT_LENGTH = 5;

const REDUNDANT_PREFIX =
  /^(?:(?:ein|eine|das|a|an|the) )?(?:foto|bild|grafik|abbildung|image|picture|photo|graphic|screenshot)(?: (?:von|vom|zeigt|of|shows|showing)\b|:|$)/u;
const IMAGE_EXTENSION = /\.(?:jpe?g|png|gif|webp|svg|avif|tiff?|bmp|heic)$/;
const GENERATED_NAME = /^(?:img|dsc|dscn|dscf|pxl|mvimg|screenshot|bildschirmfoto)[-_ ]?\d{3,}/;

export type LabelResolver = (key: string) => string;

/**
 * One own image rule. It is evaluated on the rendered img and on the values stored in the database, so the
 * rule lives here once. fileName is the base name of the image file without path and query.
 */
export interface ImageRule {
  id: string;
  impact: 'minor' | 'serious';
  isViolated(alt: string, title: string, fileName: string): boolean;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^./]+$/, '');
}

export const IMAGE_RULES: ImageRule[] = [
  {
    id: REDUNDANT_IMG_TITLE_RULE_ID,
    impact: 'minor',
    isViolated: (alt, title) => {
      const normalizedAlt = normalizeText(alt);
      return normalizedAlt !== '' && normalizedAlt === normalizeText(title);
    },
  },
  {
    id: 'a11y-img-alt-too-short',
    impact: 'minor',
    isViolated: (alt) => {
      // An empty alt text is the decorative case, not a short one.
      const length = [...normalizeText(alt)].length;
      return length > 0 && length < MIN_ALT_LENGTH;
    },
  },
  {
    id: 'a11y-img-alt-redundant-prefix',
    impact: 'minor',
    isViolated: (alt) => REDUNDANT_PREFIX.test(normalizeText(alt)),
  },
  {
    id: 'a11y-img-alt-filename',
    impact: 'serious',
    isViolated: (alt, _title, fileName) => {
      const normalizedAlt = normalizeText(alt);
      const normalizedName = normalizeText(fileName);
      return (
        (normalizedName !== '' &&
          (normalizedAlt === normalizedName || normalizedAlt === stripExtension(normalizedName))) ||
        IMAGE_EXTENSION.test(normalizedAlt) ||
        GENERATED_NAME.test(normalizedAlt)
      );
    },
  },
];

/**
 * Own checks (neither axe-core nor HTML CodeSniffer ships them) for the alt and title text of images.
 *
 * One issue is emitted per image and violated rule so each gets its own classification and edit link.
 * Images without alt text are skipped: a missing or empty alt is image-alt's concern or the editor's
 * decorative choice.
 * ViolationClassifier sends a matched node with dataAvailable !== true to the editor, hence:
 * stored values violate the rule -> dataAvailable false -> editor;
 * stored values fine but output violates (template changes the text) -> dataAvailable true -> developer;
 * unmatched image -> no content element -> developer.
 */
export class ImageRulesCheck {
  constructor(private readonly resolveLabel: LabelResolver) {}

  run(document: Document, index: ContentFactsIndex): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    document.querySelectorAll('img[alt]').forEach((img) => {
      const alt = img.getAttribute('alt') ?? '';
      if (normalizeText(alt) === '') {
        return;
      }

      const title = img.getAttribute('title') ?? '';
      const src = img.getAttribute('src') ?? '';
      const match = matchImageSource(src, index);
      const renderedFileName = this.fileNameFromSrc(src);

      for (const rule of IMAGE_RULES) {
        const violatedOutput =
          rule.isViolated(alt, title, renderedFileName) ||
          (match !== undefined && match.fileName !== '' && rule.isViolated(alt, title, match.fileName));
        if (!violatedOutput) {
          continue;
        }

        const node: IssueNode = { html: img.outerHTML, target: [this.buildSelector(img)] };
        if (match !== undefined) {
          node.contentElementUid = match.contentElementUid;
          node.dataAvailable = !rule.isViolated(match.alternative, match.title, match.fileName);
        }

        issues.push({
          id: rule.id,
          impact: rule.impact,
          description: this.resolveLabel(`rule.${rule.id}.description`),
          help: this.resolveLabel(`rule.${rule.id}.help`),
          helpUrl: 'https://www.w3.org/WAI/tutorials/images/',
          tags: ['best-practice'],
          nodes: [node],
        });
      }
    });

    return issues;
  }

  private fileNameFromSrc(src: string): string {
    const lastSegment = src.split(/[?#]/)[0].split('/').pop() ?? '';
    try {
      return decodeURIComponent(lastSegment);
    } catch {
      return lastSegment;
    }
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
