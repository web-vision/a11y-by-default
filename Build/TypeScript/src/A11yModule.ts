import { buildContentFactsIndex } from './ContentFacts';
import { AxeEngine } from './engines/AxeEngine';
import { HtmlCsEngine } from './engines/HtmlCsEngine';
import { ViolationClassifier } from './ViolationClassifier';
import type {
  AccessibilityIssue,
  Classification,
  ContentFacts,
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

  const typo3Settings = (window as unknown as Record<string, unknown>).TYPO3 as
    { settings?: { a11yByDefault?: { classificationRules?: ModuleSettings['classificationRules'] } } } | undefined;

  return {
    pageUid: parseInt(appEl.dataset['pageUid'] ?? '0', 10),
    previewUri: appEl.dataset['previewUri'] ?? '',
    contentMetadata: JSON.parse(appEl.dataset['contentMetadata'] ?? '[]') as ContentMetadataItem[],
    contentFacts: JSON.parse(appEl.dataset['contentFacts'] ?? '{}') as ContentFacts,
    axeJsUrl: appEl.dataset['axeJsUrl'] ?? '',
    htmlcsJsUrl: appEl.dataset['htmlcsJsUrl'] ?? '',
    classificationRules: typo3Settings?.settings?.a11yByDefault?.classificationRules ?? {},
  };
}

function showLoading(container: HTMLElement): void {
  container.innerHTML = `<typo3-backend-progress-bar
        label="${escapeHtml(getLabel('module.loading'))}">
    </typo3-backend-progress-bar>`;
}

function showError(container: HTMLElement, message: string): void {
  container.innerHTML = `<div class="callout callout-danger a11y-error" role="alert">
        <div class="callout-body"><p>${escapeHtml(message)}</p></div>
    </div>`;
}

function getLabel(key: string): string {
  const typo3 = (window as unknown as Record<string, unknown>).TYPO3 as { lang?: Record<string, string> } | undefined;
  return typo3?.lang?.[key] ?? key;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function impactBadgeClass(impact: string): string {
  const map: Record<string, string> = {
    critical: 'danger',
    serious: 'warning',
    moderate: 'info',
    minor: 'secondary',
  };
  return `badge text-bg-${map[impact] ?? 'secondary'}`;
}

function responsibilityBadgeClass(responsibility: string): string {
  return responsibility === 'editor' ? 'badge text-bg-primary' : 'badge text-bg-secondary';
}

// The module runs inside the backend's content iframe. Only the outer/top backend
// document carries a valid, signed route token for record/edit (set by TYPO3's
// BackendController as TYPO3.settings.FormEngine.moduleUrl) — the same base URL
// TYPO3 core itself reuses in multi-record-selection-edit-action.js. Minting a
// token client-side is not possible, so this pre-tokenized URL must be extended.
function getRecordEditModuleUrl(): string | undefined {
  const topWindow = (window.top ?? window) as unknown as Record<string, unknown>;
  const typo3 = topWindow['TYPO3'] as { settings?: { FormEngine?: { moduleUrl?: string } } } | undefined;
  return typo3?.settings?.FormEngine?.moduleUrl;
}

// The contextual (side-panel) edit route is only available from TYPO3 v14 onward.
// A11yController only emits this setting when the route exists on the running core.
function getContextualEditModuleUrl(): string | undefined {
  const typo3 = (window as unknown as Record<string, unknown>).TYPO3 as
    { settings?: { a11yByDefault?: { contextualEditModuleUrl?: string } } } | undefined;
  return typo3?.settings?.a11yByDefault?.contextualEditModuleUrl;
}

function buildContentElementEditLink(contentElementUid: number): string {
  const moduleUrl = getRecordEditModuleUrl();
  if (moduleUrl === undefined || moduleUrl === '') {
    return '';
  }

  const label = `Edit content element #${contentElementUid}`;
  const linkClasses = 'btn btn-sm btn-default mb-2 d-inline-block';
  const returnUrl = encodeURIComponent(window.location.href);
  const editHref = `${moduleUrl}&edit[tt_content][${contentElementUid}]=edit&module=web_a11y_by_default&returnUrl=${returnUrl}`;

  const contextualModuleUrl = getContextualEditModuleUrl();
  if (contextualModuleUrl !== undefined && contextualModuleUrl !== '') {
    const contextualHref = `${contextualModuleUrl}&edit[tt_content][${contentElementUid}]=edit&module=web_a11y_by_default&returnUrl=${returnUrl}`;

    return `<typo3-backend-contextual-record-edit-trigger url="${escapeHtml(contextualHref)}" edit-url="${escapeHtml(editHref)}"
               class="${linkClasses}">${label}</typo3-backend-contextual-record-edit-trigger>`;
  }

  return `<a href="${escapeHtml(editHref)}"
               class="${linkClasses}">${label}</a>`;
}

export function renderIssueCard(issue: AccessibilityIssue, classifier: ViolationClassifier): string {
  const classification: Classification = classifier.classify(issue);
  const responsibilityLabel = getLabel(`module.responsibility.${classification.responsibility}`);
  const contentElementLink =
    classification.contentElementUid !== undefined ? buildContentElementEditLink(classification.contentElementUid) : '';

  const nodes = issue.nodes.map((node) => `<pre class="mb-1"><code>${escapeHtml(node.html)}</code></pre>`).join('');

  return `<div class="card mb-2">
        <div class="card-header d-flex align-items-center gap-2 flex-wrap">
            <span class="${impactBadgeClass(issue.impact)}">${escapeHtml(issue.impact)}</span>
            <span class="${responsibilityBadgeClass(classification.responsibility)}">${escapeHtml(responsibilityLabel)}</span>
            <span class="flex-grow-1">${escapeHtml(issue.help)}</span>
            <a href="${escapeHtml(issue.helpUrl)}" target="_blank" rel="noopener noreferrer"
               class="btn btn-sm btn-default" title="${escapeHtml(getLabel('module.results.violations'))}">
                <span aria-hidden="true">?</span>
                <span class="visually-hidden">${escapeHtml(issue.help)}</span>
            </a>
        </div>
        <div class="card-body">
            <p class="card-text">${escapeHtml(issue.description)}</p>
            <p class="card-text text-body-secondary small">${escapeHtml(classification.hint)}</p>
            ${contentElementLink}
            ${nodes}
        </div>
    </div>`;
}

export function renderIssueSection(
  issues: AccessibilityIssue[],
  headingId: string,
  headingLabel: string,
  badgeClass: string,
  classifier: ViolationClassifier,
): string {
  const cards =
    issues.length === 0
      ? `<p class="text-body-secondary">${getLabel('module.results.empty')}</p>`
      : issues.map((issue) => renderIssueCard(issue, classifier)).join('');

  return `<section class="mb-4" aria-labelledby="${headingId}">
        <h2 id="${headingId}" class="h4 mb-3">
            ${headingLabel}
            <span class="badge ${badgeClass} ms-1">${issues.length}</span>
        </h2>
        ${cards}
    </section>`;
}

export function renderResults(container: HTMLElement, result: ScanResult, classifier: ViolationClassifier): void {
  const successCallout =
    result.violations.length === 0
      ? `<div class="callout callout-success mb-4"><div class="callout-body"><p>${getLabel('module.results.empty')}</p></div></div>`
      : '';

  container.innerHTML = `
        ${successCallout}
        ${renderIssueSection(result.violations, 'a11y-violations-heading', getLabel('module.results.violations'), 'text-bg-danger', classifier)}
        ${renderIssueSection(result.incomplete, 'a11y-incomplete-heading', getLabel('module.results.incomplete'), 'text-bg-warning', classifier)}`;
}

async function runScan(settings: ModuleSettings, engine: ScanEngine, resultsContainer: HTMLElement): Promise<void> {
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
      iframe.addEventListener(
        'load',
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      iframe.addEventListener(
        'error',
        () => {
          window.clearTimeout(timeout);
          reject(new Error('Iframe failed to load'));
        },
        { once: true },
      );
    });

    const contentFactsIndex = buildContentFactsIndex(settings.contentFacts);
    const classifier = new ViolationClassifier(settings.classificationRules);
    const scanEngine =
      engine === 'axe'
        ? new AxeEngine(iframe, settings.axeJsUrl, contentFactsIndex)
        : new HtmlCsEngine(iframe, settings.htmlcsJsUrl, contentFactsIndex);

    const result = await scanEngine.run();
    renderResults(resultsContainer, result, classifier);
  } finally {
    iframe.remove();
  }
}

export function initialize(): void {
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

  const executeScan = async (): Promise<void> => {
    const engine: ScanEngine = (engineSelect?.value ?? 'axe') as ScanEngine;
    scanButton.setAttribute('disabled', 'disabled');
    showLoading(resultsContainer);

    try {
      await runScan(settings, engine, resultsContainer);
    } catch (error) {
      showError(resultsContainer, error instanceof Error ? error.message : getLabel('module.error.scanFailed'));
    } finally {
      scanButton.removeAttribute('disabled');
    }
  };

  scanButton.addEventListener('click', executeScan);
  executeScan();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
