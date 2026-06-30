jest.mock('../src/engines/AxeEngine');
jest.mock('../src/engines/HtmlCsEngine');

import { AxeEngine } from '../src/engines/AxeEngine';
import { initialize, renderIssueCard, renderIssueSection, renderResults } from '../src/A11yModule';
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
            'module.responsibility.editor': 'Editor can fix',
            'module.responsibility.developer': 'Developer must fix',
            'module.responsibility.unknown': 'Needs investigation',
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
            <div id="a11y-results"></div>
        </div>`;
}

const flushPromises = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

// --- renderIssueCard ---

describe('renderIssueCard', () => {
    beforeEach(() => {
        mockTYPO3Lang();
    });

    it('renders the correct impact badge class for serious issues', () => {
        const classifier = new ViolationClassifier([], {
            'image-alt': { responsibility: 'editor', hint: 'Add alt text to images.' },
        });
        const html = renderIssueCard(makeIssue(), classifier);
        expect(html).toContain('text-bg-warning');
        expect(html).toContain('serious');
    });

    it('renders text-bg-danger badge for critical issues', () => {
        const classifier = new ViolationClassifier([], {
            'critical-rule': { responsibility: 'developer', hint: 'Fix this.' },
        });
        const html = renderIssueCard(makeIssue({ id: 'critical-rule', impact: 'critical' }), classifier);
        expect(html).toContain('text-bg-danger');
    });

    it('renders text-bg-primary badge for editor responsibility', () => {
        const classifier = new ViolationClassifier([], {
            'image-alt': { responsibility: 'editor', hint: 'Add alt text.' },
        });
        const html = renderIssueCard(makeIssue(), classifier);
        expect(html).toContain('text-bg-primary');
        expect(html).toContain('Editor can fix');
    });

    it('renders text-bg-secondary badge for developer responsibility', () => {
        const classifier = new ViolationClassifier([], {
            'image-alt': { responsibility: 'developer', hint: 'Fix in template.' },
        });
        const html = renderIssueCard(makeIssue(), classifier);
        expect(html).toContain('text-bg-secondary');
        expect(html).toContain('Developer must fix');
    });

    it('renders text-bg-secondary badge for unknown responsibility', () => {
        const classifier = new ViolationClassifier([], {});
        const html = renderIssueCard(makeIssue({ id: 'unlisted-rule' }), classifier);
        expect(html).toContain('text-bg-secondary');
        expect(html).toContain('Needs investigation');
    });

    it('shows the help text in the card header', () => {
        const classifier = new ViolationClassifier([], {});
        const html = renderIssueCard(makeIssue(), classifier);
        expect(html).toContain('Images must have alternate text');
    });

    it('shows the issue description in the card body', () => {
        const classifier = new ViolationClassifier([], {});
        const html = renderIssueCard(makeIssue(), classifier);
        expect(html).toContain('Ensures img elements have alternate text');
    });

    it('renders failing HTML nodes in code blocks', () => {
        const classifier = new ViolationClassifier([], {});
        const html = renderIssueCard(makeIssue(), classifier);
        expect(html).toContain('<code>');
        expect(html).toContain('&lt;img src=&quot;photo.jpg&quot;&gt;');
    });

    it('includes a content element edit link when the classifier identifies one', () => {
        const metadata = [{ uid: 5, CType: 'text', colPos: 0, header: 'Test', bodytext: '' }];
        const classifier = new ViolationClassifier(metadata, {
            'image-alt': { responsibility: 'editor', hint: 'Add alt text.' },
        });
        const issueWithCe = makeIssue({
            nodes: [{ html: '<img>', target: ['#c5 img'] }],
        });
        const html = renderIssueCard(issueWithCe, classifier);
        expect(html).toContain('edit[tt_content][5]');
    });

    it('omits the content element link for developer responsibility', () => {
        const classifier = new ViolationClassifier([], {
            'image-alt': { responsibility: 'developer', hint: 'Fix in template.' },
        });
        const html = renderIssueCard(makeIssue(), classifier);
        expect(html).not.toContain('edit[tt_content]');
    });
});

// --- renderIssueSection ---

describe('renderIssueSection', () => {
    beforeEach(() => {
        mockTYPO3Lang();
    });

    it('shows an empty state message when there are no issues', () => {
        const classifier = new ViolationClassifier([], {});
        const html = renderIssueSection([], 'violations-heading', 'Violations', 'text-bg-danger', classifier);
        expect(html).toContain('No accessibility issues found.');
        expect(html).not.toContain('<div class="card');
    });

    it('shows the heading with a badge containing the issue count', () => {
        const classifier = new ViolationClassifier([], {});
        const issues = [makeIssue(), makeIssue()];
        const html = renderIssueSection(issues, 'violations-heading', 'Violations', 'text-bg-danger', classifier);
        expect(html).toContain('Violations');
        expect(html).toContain('>2<');
    });

    it('renders a card for each issue', () => {
        const classifier = new ViolationClassifier([], {});
        const html = renderIssueSection(
            [makeIssue(), makeIssue({ id: 'color-contrast' })],
            'violations-heading',
            'Violations',
            'text-bg-danger',
            classifier,
        );
        const cardCount = (html.match(/class="card /g) ?? []).length;
        expect(cardCount).toBe(2);
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
        const classifier = new ViolationClassifier([], {});
        renderResults(container, EMPTY_RESULT, classifier);
        expect(container.querySelector('.callout-success')).not.toBeNull();
    });

    it('omits the success callout when violations are present', () => {
        const classifier = new ViolationClassifier([], {});
        const result: ScanResult = { ...EMPTY_RESULT, violations: [makeIssue()] };
        renderResults(container, result, classifier);
        expect(container.querySelector('.callout-success')).toBeNull();
    });

    it('always renders both violation and incomplete sections', () => {
        const classifier = new ViolationClassifier([], {});
        renderResults(container, EMPTY_RESULT, classifier);
        const sections = container.querySelectorAll('section');
        expect(sections.length).toBe(2);
    });
});

// --- initialize auto-scan ---

describe('initialize', () => {
    beforeEach(() => {
        mockTYPO3Lang();
        MockAxeEngine.mockImplementation(() => ({ run: jest.fn().mockResolvedValue(EMPTY_RESULT) } as unknown as AxeEngine));
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
        MockAxeEngine.mockImplementation(() => ({ run: jest.fn().mockReturnValue(new Promise(() => {})) } as unknown as AxeEngine));
        initialize();
        expect(document.getElementById('a11y-results')?.querySelector('typo3-backend-progress-bar')).not.toBeNull();
    });

    it('disables the scan button while the scan is running', () => {
        setupMainDom();
        MockAxeEngine.mockImplementation(() => ({ run: jest.fn().mockReturnValue(new Promise(() => {})) } as unknown as AxeEngine));
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
        MockAxeEngine.mockImplementation(() => ({
            run: jest.fn().mockRejectedValue(new Error('Scan error')),
        } as unknown as AxeEngine));
        initialize();
        await flushPromises();
        expect(document.getElementById('a11y-scan-button')?.hasAttribute('disabled')).toBe(false);
    });

    it('re-triggers the scan when the button is clicked after auto-scan', async () => {
        setupMainDom();
        mockIframeLoad();
        const mockRun = jest.fn().mockResolvedValue(EMPTY_RESULT);
        MockAxeEngine.mockImplementation(() => ({ run: mockRun } as unknown as AxeEngine));

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
        MockAxeEngine.mockImplementation(() => ({
            run: jest.fn().mockResolvedValue({
                ...EMPTY_RESULT,
                violations: [makeIssue()],
            }),
        } as unknown as AxeEngine));

        initialize();
        await flushPromises();
        expect(document.getElementById('a11y-results')?.querySelector('.card')).not.toBeNull();
    });
});
