jest.mock('../src/engines/AxeEngine');
jest.mock('../src/engines/HtmlCsEngine');

import { AxeEngine } from '../src/engines/AxeEngine';
import { initialize } from '../src/A11yModule';
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

  it('recomputes the severity badge counts for the newly active tab, not the other tab', async () => {
    setupMainDom();
    mockIframeLoad();
    MockAxeEngine.mockImplementation(
      () =>
        ({
          run: jest.fn().mockResolvedValue({
            ...EMPTY_RESULT,
            violations: [makeIssue({ id: 'developer-rule', impact: 'critical' })],
          }),
        }) as unknown as AxeEngine,
    );

    initialize();
    await flushPromises();

    // The scanned issue defaults to the "developer" view (no editor classification rule configured),
    // so the editor tab's critical badge should read 0 while it is active.
    expect(document.querySelector('[data-severity-count="critical"]')?.textContent).toBe('0');

    document.getElementById('a11y-view-tab-developer')!.click();

    expect(document.querySelector('[data-severity-count="critical"]')?.textContent).toBe('1');
  });
});
