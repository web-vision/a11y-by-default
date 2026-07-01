import { ViolationClassifier } from '../src/ViolationClassifier';
import type { AccessibilityIssue } from '../src/types';

function makeIssue(overrides: Partial<AccessibilityIssue> = {}): AccessibilityIssue {
  return {
    id: 'heading-order',
    impact: 'moderate',
    help: 'Heading levels should only increase by one',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.12/heading-order',
    description: 'Ensure the order of headings is semantically correct',
    tags: [],
    nodes: [{ html: '<h3>Heeeheeeeeheee</h3>', target: ['h3'] }],
    ...overrides,
  };
}

describe('ViolationClassifier', () => {
  it('classifies an unknown rule as unknown', () => {
    const classifier = new ViolationClassifier({});
    const classification = classifier.classify(makeIssue({ id: 'unlisted-rule' }));
    expect(classification.responsibility).toBe('unknown');
  });

  it('keeps a static developer rule as developer regardless of node resolution', () => {
    const classifier = new ViolationClassifier({
      'color-contrast': { responsibility: 'developer', hint: 'Adjust CSS colors.' },
    });
    const issue = makeIssue({
      id: 'color-contrast',
      nodes: [{ html: '<p>text</p>', target: ['p'], contentElementUid: 5 }],
    });
    expect(classifier.classify(issue)).toEqual({ responsibility: 'developer', hint: 'Adjust CSS colors.' });
  });

  it('classifies an editor rule as editor when a node resolves to a content element', () => {
    const classifier = new ViolationClassifier({
      'heading-order': {
        responsibility: 'editor',
        hint: 'Change the Header Layout.',
        developerHint: 'Fix the template.',
      },
    });
    const issue = makeIssue({ nodes: [{ html: '<h3>Heeeheeeeeheee</h3>', target: ['h3'], contentElementUid: 52 }] });
    expect(classifier.classify(issue)).toEqual({
      responsibility: 'editor',
      hint: 'Change the Header Layout.',
      contentElementUid: 52,
    });
  });

  it('downgrades an editor rule to developer using developerHint when no node resolves', () => {
    const classifier = new ViolationClassifier({
      'link-name': { responsibility: 'editor', hint: 'Add link text.', developerHint: 'Fix the template link.' },
    });
    const issue = makeIssue({ id: 'link-name', nodes: [{ html: '<a href="/"></a>', target: ['.header__logo'] }] });
    expect(classifier.classify(issue)).toEqual({ responsibility: 'developer', hint: 'Fix the template link.' });
  });

  it('falls back to the editor hint when downgrading and no developerHint is defined', () => {
    const classifier = new ViolationClassifier({
      'link-name': { responsibility: 'editor', hint: 'Add link text.' },
    });
    const issue = makeIssue({ id: 'link-name', nodes: [{ html: '<a href="/"></a>', target: ['.header__logo'] }] });
    expect(classifier.classify(issue)).toEqual({ responsibility: 'developer', hint: 'Add link text.' });
  });

  it('downgrades to developer when the matched data already exists but is not rendered', () => {
    const classifier = new ViolationClassifier({
      'image-alt': { responsibility: 'editor', hint: 'Add alt text.', developerHint: 'Fix the template rendering.' },
    });
    const issue = makeIssue({
      id: 'image-alt',
      nodes: [{ html: '<img src="photo.webp">', target: ['img'], contentElementUid: 38, dataAvailable: true }],
    });
    expect(classifier.classify(issue)).toEqual({ responsibility: 'developer', hint: 'Fix the template rendering.' });
  });

  it('uses the first resolved node when nodes are a mix of resolved and unresolved', () => {
    const classifier = new ViolationClassifier({
      'heading-order': { responsibility: 'editor', hint: 'Change the Header Layout.' },
    });
    const issue = makeIssue({
      nodes: [
        { html: '<h1>Site Title</h1>', target: ['h1'] },
        { html: '<h3>Heeeheeeeeheee</h3>', target: ['h3'], contentElementUid: 52 },
      ],
    });
    expect(classifier.classify(issue)).toEqual({
      responsibility: 'editor',
      hint: 'Change the Header Layout.',
      contentElementUid: 52,
    });
  });
});
