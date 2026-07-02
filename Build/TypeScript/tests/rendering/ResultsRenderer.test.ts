import { FilterController } from '../../src/filtering/FilterController';
import { ResultsRenderer } from '../../src/rendering/ResultsRenderer';
import { ViolationClassifier } from '../../src/ViolationClassifier';
import type { AccessibilityIssue, ScanResult } from '../../src/types';

const EMPTY_RESULT: ScanResult = { violations: [], incomplete: [], passes: [], url: '' };

function makeIssue(overrides: Partial<AccessibilityIssue> = {}): AccessibilityIssue {
  return {
    id: 'image-alt',
    impact: 'serious',
    help: 'Images must have alternate text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.6/image-alt',
    description: 'Ensures img elements have alternate text',
    tags: ['wcag2a'],
    nodes: [{ html: '<img src="photo.jpg">', target: ['#main img'] }],
    ...overrides,
  };
}

function mockTYPO3Lang(): void {
  (window as unknown as Record<string, unknown>).TYPO3 = {
    lang: {
      'module.results.violations': 'Violations',
      'module.results.incomplete': 'Needs review',
      'module.results.empty': 'No accessibility issues found.',
    },
  };
}

function makeRenderer(): ResultsRenderer {
  return new ResultsRenderer(new ViolationClassifier({}), new FilterController());
}

describe('ResultsRenderer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    mockTYPO3Lang();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders a success callout when there are no violations', () => {
    makeRenderer().render(container, EMPTY_RESULT);
    expect(container.querySelector('.callout-success')).not.toBeNull();
  });

  it('omits the success callout when violations are present', () => {
    const result: ScanResult = { ...EMPTY_RESULT, violations: [makeIssue()] };
    makeRenderer().render(container, result);
    expect(container.querySelector('.callout-success')).toBeNull();
  });

  it('omits the success callout when there are no violations but items need review', () => {
    const result: ScanResult = { ...EMPTY_RESULT, incomplete: [makeIssue()] };
    makeRenderer().render(container, result);
    expect(container.querySelector('.callout-success')).toBeNull();
  });

  it('always renders both violation and incomplete sections', () => {
    makeRenderer().render(container, EMPTY_RESULT);
    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(2);
  });

  it('always renders the needs-review info callout, even without incomplete issues', () => {
    makeRenderer().render(container, EMPTY_RESULT);
    expect(container.querySelector('.callout-info')).not.toBeNull();
  });

  it('renders the needs-review info callout under its section heading', () => {
    makeRenderer().render(container, EMPTY_RESULT);
    const section = container.querySelector('section[aria-labelledby="a11y-incomplete-heading"]');
    expect(section?.querySelector('.callout-info')).not.toBeNull();
  });

  it('renders a divider between the violations and needs-review sections', () => {
    makeRenderer().render(container, EMPTY_RESULT);
    expect(container.querySelector('hr')).not.toBeNull();
  });
});
