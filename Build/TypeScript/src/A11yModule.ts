import { AxeEngine } from './engines/AxeEngine';
import { HtmlCsEngine } from './engines/HtmlCsEngine';
import { ViolationClassifier } from './ViolationClassifier';
import type {
    AccessibilityIssue,
    Classification,
    ContentMetadataItem,
    ModuleSettings,
    ScanEngine,
    ScanResult,
} from './types';

function readSettings(): ModuleSettings | null {
    const appEl = document.getElementById('a11y-app');
    if (appEl === null) {
        return null;
    }

    const typo3Settings = (window as Record<string, unknown>).TYPO3 as
        | { settings?: { a11yByDefault?: { classificationRules?: ModuleSettings['classificationRules'] } } }
        | undefined;

    return {
        pageUid: parseInt(appEl.dataset['pageUid'] ?? '0', 10),
        previewUri: appEl.dataset['previewUri'] ?? '',
        contentMetadata: JSON.parse(appEl.dataset['contentMetadata'] ?? '[]') as ContentMetadataItem[],
        axeJsUrl: appEl.dataset['axeJsUrl'] ?? '',
        htmlcsJsUrl: appEl.dataset['htmlcsJsUrl'] ?? '',
        classificationRules: typo3Settings?.settings?.a11yByDefault?.classificationRules ?? {},
    };
}

function showLoading(container: HTMLElement): void {
    container.innerHTML = `<div class="a11y-loading" role="status" aria-live="polite">
        <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span class="a11y-loading__text">${getLabel('module.loading')}</span>
    </div>`;
}

function showError(container: HTMLElement, message: string): void {
    container.innerHTML = `<div class="callout callout-danger a11y-error" role="alert">
        <div class="callout-body"><p>${escapeHtml(message)}</p></div>
    </div>`;
}

function getLabel(key: string): string {
    const typo3 = (window as Record<string, unknown>).TYPO3 as
        | { lang?: Record<string, string> }
        | undefined;
    return typo3?.lang?.[key] ?? key;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function impactBadgeClass(impact: string): string {
    const map: Record<string, string> = {
        critical: 'danger',
        serious: 'warning',
        moderate: 'info',
        minor: 'secondary',
    };
    return `badge bg-${map[impact] ?? 'secondary'}`;
}

function responsibilityBadgeClass(responsibility: string): string {
    return responsibility === 'editor' ? 'badge bg-primary' : 'badge bg-dark';
}

function renderIssueList(issues: AccessibilityIssue[], classifier: ViolationClassifier): string {
    if (issues.length === 0) {
        return `<p class="a11y-results__empty">${getLabel('module.results.empty')}</p>`;
    }

    return issues
        .map((issue) => {
            const classification: Classification = classifier.classify(issue);
            const responsibilityLabel = getLabel(`module.responsibility.${classification.responsibility}`);
            const contentElementLink =
                classification.contentElementUid !== undefined
                    ? `<a href="/typo3/record/edit?edit[tt_content][${classification.contentElementUid}]=edit&returnUrl=."
                           class="btn btn-xs btn-default a11y-issue__edit-link">Edit content element #${classification.contentElementUid}</a>`
                    : '';

            return `<details class="a11y-issue a11y-issue--${escapeHtml(issue.impact)}">
                <summary class="a11y-issue__summary">
                    <span class="${impactBadgeClass(issue.impact)}">${escapeHtml(issue.impact)}</span>
                    <span class="${responsibilityBadgeClass(classification.responsibility)}">${escapeHtml(responsibilityLabel)}</span>
                    <span class="a11y-issue__help">${escapeHtml(issue.help)}</span>
                    <a href="${escapeHtml(issue.helpUrl)}" target="_blank" rel="noopener noreferrer"
                       class="a11y-issue__help-link">?</a>
                </summary>
                <div class="a11y-issue__body">
                    <p class="a11y-issue__description">${escapeHtml(issue.description)}</p>
                    <p class="a11y-issue__hint">${escapeHtml(classification.hint)}</p>
                    ${contentElementLink}
                    ${issue.nodes.map((node) =>
                        `<pre class="a11y-issue__node"><code>${escapeHtml(node.html)}</code></pre>`
                    ).join('')}
                </div>
            </details>`;
        })
        .join('');
}

function renderResults(container: HTMLElement, result: ScanResult, classifier: ViolationClassifier): void {
    const totalViolations = result.violations.length;
    const summary = totalViolations === 0
        ? `<div class="callout callout-success"><div class="callout-body"><p>${getLabel('module.results.empty')}</p></div></div>`
        : '';

    container.innerHTML = `
        ${summary}
        <section class="a11y-results__section" aria-labelledby="a11y-violations-heading">
            <h2 id="a11y-violations-heading" class="a11y-results__heading">
                ${getLabel('module.results.violations')}
                <span class="badge bg-danger">${totalViolations}</span>
            </h2>
            <div class="a11y-results__list">${renderIssueList(result.violations, classifier)}</div>
        </section>
        <section class="a11y-results__section" aria-labelledby="a11y-incomplete-heading">
            <h2 id="a11y-incomplete-heading" class="a11y-results__heading">
                ${getLabel('module.results.incomplete')}
                <span class="badge bg-warning">${result.incomplete.length}</span>
            </h2>
            <div class="a11y-results__list">${renderIssueList(result.incomplete, classifier)}</div>
        </section>`;
}

async function runScan(
    settings: ModuleSettings,
    engine: ScanEngine,
    resultsContainer: HTMLElement,
): Promise<void> {
    const iframe = document.createElement('iframe');
    iframe.src = settings.previewUri;
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.title = 'Accessibility scan preview';

    document.body.appendChild(iframe);

    try {
        await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => reject(new Error('Iframe load timeout after 30s')), 30000);
            iframe.addEventListener('load', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
            iframe.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error('Iframe failed to load')); }, { once: true });
        });

        const classifier = new ViolationClassifier(settings.contentMetadata, settings.classificationRules);
        const scanEngine = engine === 'axe'
            ? new AxeEngine(iframe, settings.axeJsUrl)
            : new HtmlCsEngine(iframe, settings.htmlcsJsUrl);

        const result = await scanEngine.run();
        renderResults(resultsContainer, result, classifier);
    } finally {
        iframe.remove();
    }
}

function initialize(): void {
    const settings = readSettings();
    if (settings === null || settings.pageUid === 0) {
        return;
    }

    const resultsContainer = document.getElementById('a11y-results');
    const scanButton = document.getElementById('a11y-scan-button');
    const engineSelect = document.getElementById('a11y-engine-select') as HTMLSelectElement | null;

    if (resultsContainer === null || scanButton === null) {
        return;
    }

    if (settings.previewUri === '') {
        showError(resultsContainer, getLabel('module.error.noPreview'));
        return;
    }

    scanButton.addEventListener('click', async () => {
        const engine: ScanEngine = (engineSelect?.value ?? 'axe') as ScanEngine;
        scanButton.setAttribute('disabled', 'disabled');
        showLoading(resultsContainer);

        try {
            await runScan(settings, engine, resultsContainer);
        } catch (error) {
            showError(
                resultsContainer,
                error instanceof Error ? error.message : getLabel('module.error.scanFailed'),
            );
        } finally {
            scanButton.removeAttribute('disabled');
        }
    });
}

document.addEventListener('DOMContentLoaded', initialize);
