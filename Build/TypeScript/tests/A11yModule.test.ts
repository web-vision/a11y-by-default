jest.mock('../src/engines/AxeEngine');
jest.mock('../src/engines/HtmlCsEngine');

import { AxeEngine } from '../src/engines/AxeEngine';
import {
  applyFilters,
  initialize,
  renderIssueCard,
  renderIssueSection,
  renderResults,
  updateFilterCounts,
} from '../src/A11yModule';
import { ViolationClassifier } from '../src/ViolationClassifier';
import type { AccessibilityIssue, ScanResult } from '../src/types';

const MockAxeEngine = jest.mocked(AxeEngine);

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
      'module.loading': 'Loading page and running scan…',
      'module.results.violations': 'Violations',
      'module.results.incomplete': 'Needs review',
      'module.results.empty': 'No accessibility issues found.',
      'module.error.scanFailed': 'The scan could not be completed.',
      'module.error.noPreview': 'No preview URL available for this page.',
      'module.filters.severity.critical': 'Critical',
      'module.filters.severity.serious': 'Serious',
      'module.filters.severity.moderate': 'Moderate',
      'module.filters.severity.minor': 'Minor',
    },
    settings: {
      FormEngine: {
        moduleUrl: '/typo3/record/edit?token=abc123token',
      },
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

function setupMainDom(overrides: Partial<Record<string, string>> = {}): void {
  document.body.innerHTML = `
        <div id="a11y-app"
             data-page-uid="${overrides['pageUid'] ?? '42'}"
             data-preview-uri="${overrides['previewUri'] ?? '/preview/42'}"
             data-axe-js-url="/axe.min.js"
             data-htmlcs-js-url="/HTMLCS.min.js"
             data-content-metadata="[]">
            <select id="a11y-engine-select">
                <option value="axe" selected>axe-core</option>
                <option value="htmlcs">HTML CodeSniffer</option>
            </select>
            <button id="a11y-scan-button">Run Scan</button>
            <input class="btn-check a11y-filter-severity" type="checkbox" id="a11y-filter-severity-critical" value="critical" checked>
            <label class="btn btn-sm btn-danger" for="a11y-filter-severity-critical" data-btn-class="btn-danger">
                Critical<span class="badge text-bg-light" data-severity-count="critical">0</span>
            </label>
            <button type="button" class="nav-link active" id="a11y-view-tab-editor" role="tab"
                    aria-selected="true" tabindex="0" data-view="editor">
                For editors<span class="badge text-bg-light" data-view-count="editor">0</span>
            </button>
            <button type="button" class="nav-link" id="a11y-view-tab-developer" role="tab"
                    aria-selected="false" tabindex="-1" data-view="developer">
                For developers<span class="badge text-bg-light" data-view-count="developer">0</span>
            </button>
            <div id="a11y-results"></div>
        </div>`;
}

const flushPromises = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

// --- renderIssueCard ---

describe('renderIssueCard', () => {
  beforeEach(() => {
    mockTYPO3Lang();
  });

  it('uses the task description as the collapsible header', () => {
    const classifier = new ViolationClassifier({});
    const html = renderIssueCard(makeIssue(), classifier, 'panel-1');
    expect(html).toContain('panel-title">Images must have alternate text<');
  });

  it('does not render editor/developer responsibility badges — that distinction lives in the view tabs now', () => {
    const classifier = new ViolationClassifier({
      'image-alt': { responsibility: 'editor', hint: 'Add alt text.' },
    });
    const html = renderIssueCard(makeIssue(), classifier, 'panel-1');
    expect(html).not.toContain('text-bg-primary');
    expect(html).not.toContain('text-bg-secondary');
  });

  it('wires the collapse target to the given panel id', () => {
    const classifier = new ViolationClassifier({});
    const html = renderIssueCard(makeIssue(), classifier, 'a11y-violations-group-critical-issue-0');
    expect(html).toContain('data-bs-target="#a11y-violations-group-critical-issue-0"');
    expect(html).toContain('id="a11y-violations-group-critical-issue-0"');
    expect(html).toContain('aria-controls="a11y-violations-group-critical-issue-0"');
  });

  it('starts collapsed', () => {
    const classifier = new ViolationClassifier({});
    const html = renderIssueCard(makeIssue(), classifier, 'panel-1');
    expect(html).toContain('panel-button collapsed');
    expect(html).toContain('aria-expanded="false"');
  });

  it('shows the issue description in the panel body', () => {
    const classifier = new ViolationClassifier({});
    const html = renderIssueCard(makeIssue(), classifier, 'panel-1');
    expect(html).toContain('Ensures img elements have alternate text');
  });

  it('renders failing HTML nodes in code blocks', () => {
    const classifier = new ViolationClassifier({});
    const html = renderIssueCard(makeIssue(), classifier, 'panel-1');
    expect(html).toContain('<code>');
    expect(html).toContain('&lt;img src=&quot;photo.jpg&quot;&gt;');
  });

  it('includes a content element edit link when the classifier identifies one', () => {
    const classifier = new ViolationClassifier({
      'image-alt': { responsibility: 'editor', hint: 'Add alt text.' },
    });
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderIssueCard(issueWithCe, classifier, 'panel-1');
    expect(html).toContain('edit[tt_content][5]');
  });

  it('builds the edit link from the pre-tokenized FormEngine module URL, not a raw guess', () => {
    const classifier = new ViolationClassifier({
      'image-alt': { responsibility: 'editor', hint: 'Add alt text.' },
    });
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderIssueCard(issueWithCe, classifier, 'panel-1');
    expect(html).toContain('/typo3/record/edit?token=abc123token&amp;edit[tt_content][5]=edit');
    expect(html).toContain('module=web_a11y_by_default');
    expect(html).toContain('returnUrl=');
  });

  it('omits the content element link when no valid FormEngine module URL is available', () => {
    const typo3 = (window as unknown as Record<string, unknown>)['TYPO3'] as { lang: Record<string, string> };
    (window as unknown as Record<string, unknown>).TYPO3 = { lang: typo3.lang, settings: {} };
    const classifier = new ViolationClassifier({
      'image-alt': { responsibility: 'editor', hint: 'Add alt text.' },
    });
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderIssueCard(issueWithCe, classifier, 'panel-1');
    expect(html).not.toContain('edit[tt_content]');
  });

  it('uses the side-panel edit trigger when a contextual edit module URL is available (TYPO3 v14+)', () => {
    const typo3 = (window as unknown as Record<string, unknown>)['TYPO3'] as {
      lang: Record<string, string>;
      settings: { FormEngine: { moduleUrl: string } };
    };
    (window as unknown as Record<string, unknown>).TYPO3 = {
      lang: typo3.lang,
      settings: {
        ...typo3.settings,
        a11yByDefault: { contextualEditModuleUrl: '/typo3/record/edit/contextual?token=sidepaneltoken' },
      },
    };
    const classifier = new ViolationClassifier({
      'image-alt': { responsibility: 'editor', hint: 'Add alt text.' },
    });
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderIssueCard(issueWithCe, classifier, 'panel-1');
    expect(html).toContain('<typo3-backend-contextual-record-edit-trigger');
    expect(html).toContain('url="/typo3/record/edit/contextual?token=sidepaneltoken&amp;edit[tt_content][5]=edit');
    expect(html).toContain('edit-url="/typo3/record/edit?token=abc123token&amp;edit[tt_content][5]=edit');
    expect(html).toContain('</typo3-backend-contextual-record-edit-trigger>');
  });

  it('falls back to the classic anchor when no contextual edit module URL is set (TYPO3 v13)', () => {
    const classifier = new ViolationClassifier({
      'image-alt': { responsibility: 'editor', hint: 'Add alt text.' },
    });
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderIssueCard(issueWithCe, classifier, 'panel-1');
    expect(html).not.toContain('<typo3-backend-contextual-record-edit-trigger');
    expect(html).toContain('<a href="/typo3/record/edit?token=abc123token&amp;edit[tt_content][5]=edit');
  });

  it('omits the content element link for developer responsibility', () => {
    const classifier = new ViolationClassifier({
      'image-alt': { responsibility: 'developer', hint: 'Fix in template.' },
    });
    const html = renderIssueCard(makeIssue(), classifier, 'panel-1');
    expect(html).not.toContain('edit[tt_content]');
  });

  it('includes data attributes for impact and responsibility to support filtering', () => {
    const classifier = new ViolationClassifier({
      'image-alt': { responsibility: 'editor', hint: 'Add alt text.' },
    });
    const issue = makeIssue({
      impact: 'critical',
      nodes: [{ html: '<img src="photo.jpg">', target: ['#main img'], contentElementUid: 5 }],
    });
    const html = renderIssueCard(issue, classifier, 'panel-1');
    expect(html).toContain('data-impact="critical"');
    expect(html).toContain('data-responsibility="editor"');
  });
});

// --- renderIssueSection ---

describe('renderIssueSection', () => {
  beforeEach(() => {
    mockTYPO3Lang();
  });

  it('shows an empty state message when there are no issues', () => {
    const classifier = new ViolationClassifier({});
    const html = renderIssueSection(
      [],
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
      classifier,
    );
    expect(html).toContain('No accessibility issues found.');
    expect(html).not.toContain('data-severity-group');
  });

  it('shows the heading with a badge containing the issue count', () => {
    const classifier = new ViolationClassifier({});
    const issues = [makeIssue(), makeIssue()];
    const html = renderIssueSection(
      issues,
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
      classifier,
    );
    expect(html).toContain('Violations');
    expect(html).toContain('>2<');
  });

  it('gives the count badge the provided id so it can be updated after filtering', () => {
    const classifier = new ViolationClassifier({});
    const html = renderIssueSection(
      [makeIssue()],
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
      classifier,
    );
    expect(html).toContain('id="violations-count"');
  });

  it('renders a task panel for each issue', () => {
    const classifier = new ViolationClassifier({});
    const html = renderIssueSection(
      [makeIssue(), makeIssue({ id: 'color-contrast' })],
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
      classifier,
    );
    const taskCount = (html.match(/data-impact="/g) ?? []).length;
    expect(taskCount).toBe(2);
  });

  it('groups issues of the same severity under one collapsible group', () => {
    const classifier = new ViolationClassifier({});
    const issues = [
      makeIssue({ id: 'image-alt', impact: 'critical' }),
      makeIssue({ id: 'color-contrast', impact: 'critical' }),
    ];
    const html = renderIssueSection(
      issues,
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
      classifier,
    );
    const groupCount = (html.match(/data-severity-group="critical"/g) ?? []).length;
    expect(groupCount).toBe(1);
    expect(html).toContain('data-severity-group-count>2<');
  });

  it('orders severity groups from critical down to minor, regardless of issue order', () => {
    const classifier = new ViolationClassifier({});
    const issues = [
      makeIssue({ id: 'minor-rule', impact: 'minor' }),
      makeIssue({ id: 'critical-rule', impact: 'critical' }),
      makeIssue({ id: 'moderate-rule', impact: 'moderate' }),
    ];
    const html = renderIssueSection(
      issues,
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
      classifier,
    );
    const criticalIndex = html.indexOf('data-severity-group="critical"');
    const moderateIndex = html.indexOf('data-severity-group="moderate"');
    const minorIndex = html.indexOf('data-severity-group="minor"');
    expect(criticalIndex).toBeLessThan(moderateIndex);
    expect(moderateIndex).toBeLessThan(minorIndex);
  });

  it('omits a severity group entirely when no issue has that severity', () => {
    const classifier = new ViolationClassifier({});
    const html = renderIssueSection(
      [makeIssue({ impact: 'critical' })],
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
      classifier,
    );
    expect(html).not.toContain('data-severity-group="minor"');
  });

  it("colors each severity group's header to match its filter button color", () => {
    const classifier = new ViolationClassifier({});
    const issues = [
      makeIssue({ id: 'critical-rule', impact: 'critical' }),
      makeIssue({ id: 'serious-rule', impact: 'serious' }),
      makeIssue({ id: 'moderate-rule', impact: 'moderate' }),
      makeIssue({ id: 'minor-rule', impact: 'minor' }),
    ];
    const html = renderIssueSection(
      issues,
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
      classifier,
    );
    expect(html).toContain('panel panel-danger mb-2" data-severity-group="critical"');
    expect(html).toContain('panel panel-warning mb-2" data-severity-group="serious"');
    expect(html).toContain('panel panel-info mb-2" data-severity-group="moderate"');
    expect(html).toContain('panel panel-secondary mb-2" data-severity-group="minor"');
  });
});

// --- renderResults ---

describe('renderResults', () => {
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
    const classifier = new ViolationClassifier({});
    renderResults(container, EMPTY_RESULT, classifier);
    expect(container.querySelector('.callout-success')).not.toBeNull();
  });

  it('omits the success callout when violations are present', () => {
    const classifier = new ViolationClassifier({});
    const result: ScanResult = { ...EMPTY_RESULT, violations: [makeIssue()] };
    renderResults(container, result, classifier);
    expect(container.querySelector('.callout-success')).toBeNull();
  });

  it('always renders both violation and incomplete sections', () => {
    const classifier = new ViolationClassifier({});
    renderResults(container, EMPTY_RESULT, classifier);
    const sections = container.querySelectorAll('section');
    expect(sections.length).toBe(2);
  });

  it('omits the needs-review info callout when there are no incomplete issues', () => {
    const classifier = new ViolationClassifier({});
    renderResults(container, EMPTY_RESULT, classifier);
    expect(container.querySelector('.callout-info')).toBeNull();
  });

  it('renders a needs-review info callout when incomplete issues are present', () => {
    const classifier = new ViolationClassifier({});
    const result: ScanResult = { ...EMPTY_RESULT, incomplete: [makeIssue()] };
    renderResults(container, result, classifier);
    expect(container.querySelector('.callout-info')).not.toBeNull();
  });
});

// --- applyFilters ---

describe('applyFilters', () => {
  let container: HTMLElement;

  beforeEach(() => {
    mockTYPO3Lang();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function appendFilterCheckboxes(overrides: Partial<Record<string, boolean>> = {}): void {
    const activeView = overrides['developer'] === true ? 'developer' : 'editor';
    const filters = document.createElement('div');
    filters.innerHTML = `
      <input type="checkbox" class="a11y-filter-severity" value="critical" ${overrides['critical'] !== false ? 'checked' : ''}>
      <input type="checkbox" class="a11y-filter-severity" value="serious" ${overrides['serious'] !== false ? 'checked' : ''}>
      <input type="checkbox" class="a11y-filter-severity" value="moderate" ${overrides['moderate'] !== false ? 'checked' : ''}>
      <input type="checkbox" class="a11y-filter-severity" value="minor" ${overrides['minor'] !== false ? 'checked' : ''}>
      <button type="button" role="tab" data-view="editor" aria-selected="${String(activeView === 'editor')}"></button>
      <button type="button" role="tab" data-view="developer" aria-selected="${String(activeView === 'developer')}"></button>`;
    document.body.appendChild(filters);
  }

  it('hides the whole severity group when its severity checkbox is unchecked', () => {
    appendFilterCheckboxes({ minor: false });
    container.innerHTML = `
      <div data-severity-group="critical"><div data-impact="critical" data-responsibility="editor"></div></div>
      <div data-severity-group="minor"><div data-impact="minor" data-responsibility="editor"></div></div>`;

    applyFilters(container);

    const groups = container.querySelectorAll('[data-severity-group]');
    expect(groups[0]?.classList.contains('d-none')).toBe(false);
    expect(groups[1]?.classList.contains('d-none')).toBe(true);
  });

  it('hides developer-responsibility tasks on the editor tab so editors only see editor tasks', () => {
    appendFilterCheckboxes();
    container.innerHTML = `
      <div data-severity-group="critical">
        <div data-impact="critical" data-responsibility="editor"></div>
        <div data-impact="critical" data-responsibility="developer"></div>
      </div>`;

    applyFilters(container);

    const tasks = container.querySelectorAll('[data-impact]');
    expect(tasks[0]?.classList.contains('d-none')).toBe(false);
    expect(tasks[1]?.classList.contains('d-none')).toBe(true);
  });

  it('shows only developer-responsibility tasks once the developer tab is active', () => {
    appendFilterCheckboxes({ developer: true });
    container.innerHTML = `
      <div data-severity-group="critical">
        <div data-impact="critical" data-responsibility="editor"></div>
        <div data-impact="critical" data-responsibility="developer"></div>
      </div>`;

    applyFilters(container);

    const tasks = container.querySelectorAll('[data-impact]');
    expect(tasks[0]?.classList.contains('d-none')).toBe(true);
    expect(tasks[1]?.classList.contains('d-none')).toBe(false);
  });

  it('hides a severity group entirely once every task inside it is filtered out by the active view', () => {
    appendFilterCheckboxes();
    container.innerHTML = `
      <div data-severity-group="critical"><div data-impact="critical" data-responsibility="developer"></div></div>`;

    applyFilters(container);

    expect(container.querySelector('[data-severity-group]')?.classList.contains('d-none')).toBe(true);
  });

  it("updates each severity group's own count badge to the number of currently visible tasks", () => {
    appendFilterCheckboxes();
    container.innerHTML = `
      <div data-severity-group="critical">
        <span data-severity-group-count>2</span>
        <div data-impact="critical" data-responsibility="editor"></div>
        <div data-impact="critical" data-responsibility="developer"></div>
      </div>`;

    applyFilters(container);

    expect(container.querySelector('[data-severity-group-count]')?.textContent).toBe('1');
  });

  it('updates the violations and needs-review badge counts to reflect only visible tasks', () => {
    appendFilterCheckboxes({ minor: false });
    container.innerHTML = `
      <section aria-labelledby="a11y-violations-heading">
        <h2><span id="a11y-violations-count">2</span></h2>
        <div data-severity-group="critical"><div data-impact="critical" data-responsibility="editor"></div></div>
        <div data-severity-group="minor"><div data-impact="minor" data-responsibility="editor"></div></div>
      </section>
      <section aria-labelledby="a11y-incomplete-heading">
        <h2><span id="a11y-incomplete-count">1</span></h2>
        <div data-severity-group="critical"><div data-impact="critical" data-responsibility="editor"></div></div>
      </section>`;

    applyFilters(container);

    expect(document.getElementById('a11y-violations-count')?.textContent).toBe('1');
    expect(document.getElementById('a11y-incomplete-count')?.textContent).toBe('1');

    (document.querySelector('.a11y-filter-severity[value="minor"]') as HTMLInputElement).checked = true;
    applyFilters(container);

    expect(document.getElementById('a11y-violations-count')?.textContent).toBe('2');
  });
});

// --- updateFilterCounts ---

describe('updateFilterCounts', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    const filterButtons = document.createElement('div');
    filterButtons.innerHTML = `
      <input type="checkbox" id="a11y-filter-severity-critical">
      <span data-severity-count="critical">0</span>
      <input type="checkbox" id="a11y-filter-severity-serious">
      <span data-severity-count="serious">0</span>
      <input type="checkbox" id="a11y-filter-severity-moderate">
      <span data-severity-count="moderate">0</span>
      <input type="checkbox" id="a11y-filter-severity-minor">
      <span data-severity-count="minor">0</span>
      <span data-view-count="editor">0</span>
      <span data-view-count="developer">0</span>`;
    document.body.appendChild(filterButtons);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('counts found issues per severity', () => {
    container.innerHTML = `
      <div class="card" data-impact="critical" data-responsibility="editor"></div>
      <div class="card" data-impact="critical" data-responsibility="editor"></div>
      <div class="card" data-impact="minor" data-responsibility="editor"></div>`;

    updateFilterCounts(container);

    expect(document.querySelector('[data-severity-count="critical"]')?.textContent).toBe('2');
    expect(document.querySelector('[data-severity-count="serious"]')?.textContent).toBe('0');
    expect(document.querySelector('[data-severity-count="minor"]')?.textContent).toBe('1');
  });

  it('counts editor issues and non-editor issues separately for the view tabs', () => {
    container.innerHTML = `
      <div class="card" data-impact="critical" data-responsibility="editor"></div>
      <div class="card" data-impact="serious" data-responsibility="developer"></div>
      <div class="card" data-impact="moderate" data-responsibility="unknown"></div>`;

    updateFilterCounts(container);

    expect(document.querySelector('[data-view-count="editor"]')?.textContent).toBe('1');
    expect(document.querySelector('[data-view-count="developer"]')?.textContent).toBe('2');
  });

  it('disables severity filter buttons that have zero findings', () => {
    container.innerHTML = '<div class="card" data-impact="critical" data-responsibility="editor"></div>';

    updateFilterCounts(container);

    expect((document.getElementById('a11y-filter-severity-critical') as HTMLInputElement).disabled).toBe(false);
    expect((document.getElementById('a11y-filter-severity-minor') as HTMLInputElement).disabled).toBe(true);
  });

  it('re-enables a severity filter button once matching findings appear again', () => {
    container.innerHTML = '';
    updateFilterCounts(container);
    expect((document.getElementById('a11y-filter-severity-minor') as HTMLInputElement).disabled).toBe(true);

    container.innerHTML = '<div class="card" data-impact="minor" data-responsibility="editor"></div>';
    updateFilterCounts(container);
    expect((document.getElementById('a11y-filter-severity-minor') as HTMLInputElement).disabled).toBe(false);
  });
});

// --- initialize auto-scan ---

describe('initialize', () => {
  beforeEach(() => {
    mockTYPO3Lang();
    MockAxeEngine.mockImplementation(
      () => ({ run: jest.fn().mockResolvedValue(EMPTY_RESULT) }) as unknown as AxeEngine,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('returns early without error when #a11y-app is absent', () => {
    document.body.innerHTML = '';
    expect(() => initialize()).not.toThrow();
    expect(MockAxeEngine).not.toHaveBeenCalled();
  });

  it('returns early when pageUid is 0', () => {
    setupMainDom({ pageUid: '0' });
    initialize();
    expect(MockAxeEngine).not.toHaveBeenCalled();
  });

  it('shows an error message when previewUri is empty', () => {
    setupMainDom({ previewUri: '' });
    initialize();
    expect(document.getElementById('a11y-results')?.querySelector('.callout-danger')).not.toBeNull();
    expect(MockAxeEngine).not.toHaveBeenCalled();
  });

  it('auto-starts the scan without a button click', async () => {
    setupMainDom();
    mockIframeLoad();
    initialize();
    await flushPromises();
    const results = document.getElementById('a11y-results');
    expect(results?.innerHTML).not.toBe('');
    expect(MockAxeEngine).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator immediately (before iframe loads)', () => {
    setupMainDom();
    // Do not mock iframe load — scan stays pending
    jest.spyOn(document.body, 'appendChild').mockImplementation(function (this: Node, node: Node): Node {
      return Node.prototype.appendChild.call(this, node);
    });
    MockAxeEngine.mockImplementation(
      () => ({ run: jest.fn().mockReturnValue(new Promise(() => {})) }) as unknown as AxeEngine,
    );
    initialize();
    expect(document.getElementById('a11y-results')?.querySelector('typo3-backend-progress-bar')).not.toBeNull();
  });

  it('disables the scan button while the scan is running', () => {
    setupMainDom();
    MockAxeEngine.mockImplementation(
      () => ({ run: jest.fn().mockReturnValue(new Promise(() => {})) }) as unknown as AxeEngine,
    );
    initialize();
    expect(document.getElementById('a11y-scan-button')?.hasAttribute('disabled')).toBe(true);
  });

  it('re-enables the scan button after the scan completes', async () => {
    setupMainDom();
    mockIframeLoad();
    initialize();
    await flushPromises();
    expect(document.getElementById('a11y-scan-button')?.hasAttribute('disabled')).toBe(false);
  });

  it('re-enables the scan button even when the scan fails', async () => {
    setupMainDom();
    mockIframeLoad();
    MockAxeEngine.mockImplementation(
      () =>
        ({
          run: jest.fn().mockRejectedValue(new Error('Scan error')),
        }) as unknown as AxeEngine,
    );
    initialize();
    await flushPromises();
    expect(document.getElementById('a11y-scan-button')?.hasAttribute('disabled')).toBe(false);
  });

  it('re-triggers the scan when the button is clicked after auto-scan', async () => {
    setupMainDom();
    mockIframeLoad();
    const mockRun = jest.fn().mockResolvedValue(EMPTY_RESULT);
    MockAxeEngine.mockImplementation(() => ({ run: mockRun }) as unknown as AxeEngine);

    initialize();
    await flushPromises();
    expect(mockRun).toHaveBeenCalledTimes(1);

    document.getElementById('a11y-scan-button')!.click();
    await flushPromises();
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it('renders results in the #a11y-results container after scan', async () => {
    setupMainDom();
    mockIframeLoad();
    MockAxeEngine.mockImplementation(
      () =>
        ({
          run: jest.fn().mockResolvedValue({
            ...EMPTY_RESULT,
            violations: [makeIssue()],
          }),
        }) as unknown as AxeEngine,
    );

    initialize();
    await flushPromises();
    expect(document.getElementById('a11y-results')?.querySelector('[data-impact]')).not.toBeNull();
  });

  it('gives the severity toggle its colored button class to match its initial checked state', () => {
    setupMainDom();
    initialize();
    const label = document.querySelector('label[for="a11y-filter-severity-critical"]');
    expect(label?.classList.contains('btn-danger')).toBe(true);
    expect(label?.classList.contains('btn-default')).toBe(false);
  });

  it('swaps the toggle button to the neutral btn-default class when the filter checkbox is unchecked', () => {
    setupMainDom();
    initialize();
    const checkbox = document.getElementById('a11y-filter-severity-critical') as HTMLInputElement;
    const label = document.querySelector('label[for="a11y-filter-severity-critical"]');

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    expect(label?.classList.contains('btn-danger')).toBe(false);
    expect(label?.classList.contains('btn-default')).toBe(true);
  });

  it('switches the active view tab and re-filters results when the developer tab is clicked', async () => {
    setupMainDom();
    mockIframeLoad();
    MockAxeEngine.mockImplementation(
      () =>
        ({
          run: jest.fn().mockResolvedValue({
            ...EMPTY_RESULT,
            violations: [makeIssue({ id: 'editor-rule' }), makeIssue({ id: 'developer-rule', impact: 'critical' })],
          }),
        }) as unknown as AxeEngine,
    );

    initialize();
    await flushPromises();

    const editorTab = document.getElementById('a11y-view-tab-editor') as HTMLElement;
    const developerTab = document.getElementById('a11y-view-tab-developer') as HTMLElement;
    expect(editorTab.getAttribute('aria-selected')).toBe('true');

    developerTab.click();

    expect(developerTab.getAttribute('aria-selected')).toBe('true');
    expect(editorTab.getAttribute('aria-selected')).toBe('false');
    expect(document.getElementById('a11y-results')?.getAttribute('aria-labelledby')).toBe('a11y-view-tab-developer');
  });
});
