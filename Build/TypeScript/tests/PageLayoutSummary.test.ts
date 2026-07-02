jest.mock('../src/engines/AxeEngine');

import { AxeEngine } from '../src/engines/AxeEngine';
import { countByImpact, filterForAccess, readSettings, renderSummary, runAutoScan } from '../src/PageLayoutSummary';
import { ViolationClassifier } from '../src/ViolationClassifier';
import type { AccessibilityIssue, ClassificationRule, ScanResult } from '../src/types';

const MockAxeEngine = jest.mocked(AxeEngine);

const EMPTY_RESULT: ScanResult = { violations: [], incomplete: [], passes: [], url: '' };

const TEST_CLASSIFICATION_RULES: Record<string, ClassificationRule> = {
  'test-rule': { responsibility: 'editor', hint: 'Editor hint' },
};

function makeIssue(impact: string, id = 'test-rule'): AccessibilityIssue {
  return {
    id,
    impact,
    help: 'Fix this issue',
    helpUrl: 'https://example.com/rule',
    description: 'This is a test violation',
    tags: [],
    // contentElementUid + dataAvailable: false simulate an axe finding correlated to a
    // content element with missing DB data — the case ViolationClassifier treats as editor-fixable.
    nodes: [{ html: '<img src="test.jpg">', target: ['img'], contentElementUid: 1, dataAvailable: false }],
  };
}

function mockTYPO3Lang(): void {
  (window as unknown as Record<string, unknown>).TYPO3 = {
    lang: {
      'module.loading': 'Loading…',
      'module.results.empty': 'No accessibility issues found.',
      'module.results.incomplete': 'Needs review',
      'module.error.scanFailed': 'The scan could not be completed.',
      'pageHint.label': 'Check Accessibility',
    },
  };
}

function mockIframeLoad(): void {
  const origAppend = Node.prototype.appendChild;
  jest.spyOn(document.body, 'appendChild').mockImplementation(function (this: Node, node: Node): Node {
    const result = origAppend.call(this, node);
    if (node instanceof HTMLIFrameElement) {
      queueMicrotask(() => node.dispatchEvent(new Event('load')));
    }
    return result;
  });
}

function setupAppElement(overrides: Partial<Record<string, string>> = {}): HTMLElement {
  const el = document.createElement('div');
  el.id = 'a11y-page-summary-app';
  el.dataset['pageUid'] = overrides['pageUid'] ?? '42';
  el.dataset['previewUri'] = overrides['previewUri'] ?? '/preview/42';
  el.dataset['axeJsUrl'] = overrides['axeJsUrl'] ?? '/axe.min.js';
  el.dataset['moduleUrl'] = overrides['moduleUrl'] ?? '/typo3/module?id=42';
  el.dataset['contentFacts'] = overrides['contentFacts'] ?? '{}';
  el.dataset['classificationRules'] = overrides['classificationRules'] ?? JSON.stringify(TEST_CLASSIFICATION_RULES);
  el.dataset['hasDeveloperCornerAccess'] = overrides['hasDeveloperCornerAccess'] ?? '0';
  document.body.appendChild(el);
  return el;
}

// --- countByImpact ---

describe('countByImpact', () => {
  it('returns all zeros for an empty array', () => {
    expect(countByImpact([])).toEqual({ critical: 0, serious: 0, moderate: 0, minor: 0 });
  });

  it('counts violations by impact level', () => {
    const issues = [makeIssue('critical'), makeIssue('critical'), makeIssue('serious'), makeIssue('moderate')];
    expect(countByImpact(issues)).toEqual({ critical: 2, serious: 1, moderate: 1, minor: 0 });
  });

  it('ignores issues with unknown impact levels', () => {
    expect(countByImpact([makeIssue('unknown')])).toEqual({
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
    });
  });

  it('counts all four impact levels independently', () => {
    const issues = ['critical', 'serious', 'moderate', 'minor'].map((impact) => makeIssue(impact));
    expect(countByImpact(issues)).toEqual({ critical: 1, serious: 1, moderate: 1, minor: 1 });
  });
});

// --- readSettings ---

describe('readSettings', () => {
  afterEach(() => {
    document.getElementById('a11y-page-summary-app')?.remove();
  });

  it('returns null when app element is absent', () => {
    expect(readSettings()).toBeNull();
  });

  it('parses all data attributes from the app element', () => {
    setupAppElement();
    expect(readSettings()).toEqual({
      pageUid: 42,
      previewUri: '/preview/42',
      axeJsUrl: '/axe.min.js',
      moduleUrl: '/typo3/module?id=42',
      contentFacts: {},
      classificationRules: TEST_CLASSIFICATION_RULES,
      hasDeveloperCornerAccess: false,
    });
  });

  it('parses hasDeveloperCornerAccess as a boolean', () => {
    setupAppElement({ hasDeveloperCornerAccess: '1' });
    expect(readSettings()?.hasDeveloperCornerAccess).toBe(true);
  });

  it('parses pageUid as an integer', () => {
    setupAppElement({ pageUid: '7' });
    expect(readSettings()?.pageUid).toBe(7);
  });
});

// --- filterForAccess ---

describe('filterForAccess', () => {
  const rules: Record<string, ClassificationRule> = {
    'editor-rule': { responsibility: 'editor', hint: 'Editor hint' },
    'developer-rule': { responsibility: 'developer', hint: 'Developer hint' },
  };
  const classifier = new ViolationClassifier(rules);

  it('returns only editor-responsibility issues without developer corner access', () => {
    const issues = [makeIssue('critical', 'editor-rule'), makeIssue('serious', 'developer-rule')];
    const filtered = filterForAccess(issues, classifier, false);
    expect(filtered).toEqual([issues[0]]);
  });

  it('hides issues with no matching classification rule without developer corner access', () => {
    const issues = [makeIssue('critical', 'unclassified-rule')];
    expect(filterForAccess(issues, classifier, false)).toEqual([]);
  });

  it('returns all issues with developer corner access', () => {
    const issues = [makeIssue('critical', 'editor-rule'), makeIssue('serious', 'developer-rule')];
    expect(filterForAccess(issues, classifier, true)).toEqual(issues);
  });
});

// --- renderSummary ---

describe('renderSummary', () => {
  let container: HTMLElement;

  beforeEach(() => {
    mockTYPO3Lang();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders a success callout when there are no violations or incomplete issues', () => {
    renderSummary(container, EMPTY_RESULT, '/module');
    expect(container.querySelector('.callout-success')).not.toBeNull();
    expect(container.querySelector('.callout-warning')).toBeNull();
  });

  it('includes a link to the module in the success callout', () => {
    renderSummary(container, EMPTY_RESULT, '/module?id=99');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/module?id=99');
  });

  it('renders a warning callout when violations are present', () => {
    const result: ScanResult = { ...EMPTY_RESULT, violations: [makeIssue('serious')] };
    renderSummary(container, result, '/module');
    expect(container.querySelector('.callout-warning')).not.toBeNull();
    expect(container.querySelector('.callout-success')).toBeNull();
  });

  it('shows a text-bg-danger badge for critical violations', () => {
    const result: ScanResult = {
      ...EMPTY_RESULT,
      violations: [makeIssue('critical'), makeIssue('critical')],
    };
    renderSummary(container, result, '/module');
    const badge = container.querySelector('.text-bg-danger');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('2');
  });

  it('shows a text-bg-warning badge for serious violations', () => {
    const result: ScanResult = { ...EMPTY_RESULT, violations: [makeIssue('serious')] };
    renderSummary(container, result, '/module');
    expect(container.querySelector('.text-bg-warning')).not.toBeNull();
  });

  it('shows a text-bg-info badge for moderate violations', () => {
    const result: ScanResult = { ...EMPTY_RESULT, violations: [makeIssue('moderate')] };
    renderSummary(container, result, '/module');
    expect(container.querySelector('.text-bg-info')).not.toBeNull();
  });

  it('shows a text-bg-secondary badge for minor violations', () => {
    const result: ScanResult = { ...EMPTY_RESULT, violations: [makeIssue('minor')] };
    renderSummary(container, result, '/module');
    expect(container.querySelector('.text-bg-secondary')).not.toBeNull();
  });

  it('does not render a badge for impact levels with zero count', () => {
    const result: ScanResult = { ...EMPTY_RESULT, violations: [makeIssue('critical')] };
    renderSummary(container, result, '/module');
    const badgeTexts = Array.from(container.querySelectorAll('.badge')).map((b) => b.textContent ?? '');
    expect(badgeTexts.some((t) => t.includes('serious'))).toBe(false);
    expect(badgeTexts.some((t) => t.includes('moderate'))).toBe(false);
    expect(badgeTexts.some((t) => t.includes('minor'))).toBe(false);
  });

  it('shows a badge for incomplete issues even without violations', () => {
    const result: ScanResult = { ...EMPTY_RESULT, incomplete: [makeIssue('moderate')] };
    renderSummary(container, result, '/module');
    expect(container.querySelector('.callout-warning')).not.toBeNull();
    const badges = container.querySelectorAll('.badge');
    const hasIncomplete = Array.from(badges).some((b) => b.textContent?.includes('1'));
    expect(hasIncomplete).toBe(true);
  });

  it('includes a link to the module in the warning callout', () => {
    const result: ScanResult = { ...EMPTY_RESULT, violations: [makeIssue('serious')] };
    renderSummary(container, result, '/module?id=5');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/module?id=5');
  });
});

// --- runAutoScan ---

describe('runAutoScan', () => {
  beforeEach(() => {
    mockTYPO3Lang();
    mockIframeLoad();
    MockAxeEngine.mockImplementation(
      () => ({ run: jest.fn().mockResolvedValue(EMPTY_RESULT) }) as unknown as AxeEngine,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.getElementById('a11y-page-summary-app')?.remove();
    document.querySelectorAll('iframe').forEach((f) => f.remove());
  });

  it('returns without error when app element is absent', async () => {
    await expect(runAutoScan()).resolves.toBeUndefined();
    expect(MockAxeEngine).not.toHaveBeenCalled();
  });

  it('returns without scanning when previewUri is empty', async () => {
    setupAppElement({ previewUri: '' });
    await runAutoScan();
    expect(MockAxeEngine).not.toHaveBeenCalled();
  });

  it('shows loading indicator before the scan completes', () => {
    setupAppElement();
    // AxeEngine.run never resolves — scan stays in progress
    MockAxeEngine.mockImplementation(
      () => ({ run: jest.fn().mockReturnValue(new Promise(() => {})) }) as unknown as AxeEngine,
    );
    // Don't await — check synchronous state up to first await
    runAutoScan();
    const el = document.getElementById('a11y-page-summary-app');
    expect(el?.querySelector('typo3-backend-progress-bar')).not.toBeNull();
  });

  it('renders a success callout when no violations are found', async () => {
    setupAppElement();
    await runAutoScan();
    const el = document.getElementById('a11y-page-summary-app');
    expect(el?.querySelector('.callout-success')).not.toBeNull();
  });

  it('renders a warning callout with badges when violations are found', async () => {
    setupAppElement();
    MockAxeEngine.mockImplementation(
      () =>
        ({
          run: jest.fn().mockResolvedValue({
            ...EMPTY_RESULT,
            violations: [makeIssue('serious'), makeIssue('critical')],
          }),
        }) as unknown as AxeEngine,
    );
    await runAutoScan();
    const el = document.getElementById('a11y-page-summary-app');
    expect(el?.querySelector('.callout-warning')).not.toBeNull();
    expect(el?.querySelector('.text-bg-danger')).not.toBeNull();
    expect(el?.querySelector('.text-bg-warning')).not.toBeNull();
  });

  it('renders an error callout when the scan engine throws', async () => {
    setupAppElement();
    MockAxeEngine.mockImplementation(
      () =>
        ({
          run: jest.fn().mockRejectedValue(new Error('axe-core crashed')),
        }) as unknown as AxeEngine,
    );
    await runAutoScan();
    const el = document.getElementById('a11y-page-summary-app');
    expect(el?.querySelector('.callout-danger')).not.toBeNull();
  });

  it('removes the iframe from the DOM after the scan completes', async () => {
    setupAppElement();
    await runAutoScan();
    expect(document.querySelectorAll('iframe').length).toBe(0);
  });

  it('removes the iframe even when the scan fails', async () => {
    setupAppElement();
    MockAxeEngine.mockImplementation(
      () =>
        ({
          run: jest.fn().mockRejectedValue(new Error('failed')),
        }) as unknown as AxeEngine,
    );
    await runAutoScan();
    expect(document.querySelectorAll('iframe').length).toBe(0);
  });

  it('hides developer-only issues from the summary without developer corner access', async () => {
    setupAppElement({
      classificationRules: JSON.stringify({
        'editor-rule': { responsibility: 'editor', hint: 'Editor hint' },
        'developer-rule': { responsibility: 'developer', hint: 'Developer hint' },
      }),
      hasDeveloperCornerAccess: '0',
    });
    MockAxeEngine.mockImplementation(
      () =>
        ({
          run: jest.fn().mockResolvedValue({
            ...EMPTY_RESULT,
            violations: [makeIssue('critical', 'editor-rule'), makeIssue('serious', 'developer-rule')],
          }),
        }) as unknown as AxeEngine,
    );
    await runAutoScan();
    const el = document.getElementById('a11y-page-summary-app');
    expect(el?.querySelector('.text-bg-danger')).not.toBeNull();
    expect(el?.querySelector('.text-bg-warning')).toBeNull();
  });

  it('shows developer issues in the summary with developer corner access', async () => {
    setupAppElement({
      classificationRules: JSON.stringify({
        'editor-rule': { responsibility: 'editor', hint: 'Editor hint' },
        'developer-rule': { responsibility: 'developer', hint: 'Developer hint' },
      }),
      hasDeveloperCornerAccess: '1',
    });
    MockAxeEngine.mockImplementation(
      () =>
        ({
          run: jest.fn().mockResolvedValue({
            ...EMPTY_RESULT,
            violations: [makeIssue('critical', 'editor-rule'), makeIssue('serious', 'developer-rule')],
          }),
        }) as unknown as AxeEngine,
    );
    await runAutoScan();
    const el = document.getElementById('a11y-page-summary-app');
    expect(el?.querySelector('.text-bg-danger')).not.toBeNull();
    expect(el?.querySelector('.text-bg-warning')).not.toBeNull();
  });
});
