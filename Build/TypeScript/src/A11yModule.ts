import './CodeViewer';
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

// The same color family as the severity filter buttons (btn-danger/warning/
// info/secondary), applied here via TYPO3's panel-* variants so the group
// header background/text/caret pick up the matching theme-aware colors.
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'danger',
  serious: 'warning',
  moderate: 'info',
  minor: 'secondary',
};

function severityPanelClass(impact: string): string {
  return `panel-${SEVERITY_COLORS[impact] ?? 'secondary'}`;
}

const SEVERITY_LEVELS = ['critical', 'serious', 'moderate', 'minor'] as const;

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
function getContextualEditModuleUrl(): string | null | undefined {
  const typo3 = (window as unknown as Record<string, unknown>).TYPO3 as
    { settings?: { a11yByDefault?: { contextualEditModuleUrl?: string | null } } } | undefined;
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
  if (contextualModuleUrl !== undefined && contextualModuleUrl !== null && contextualModuleUrl !== '') {
    const contextualHref = `${contextualModuleUrl}&edit[tt_content][${contentElementUid}]=edit&module=web_a11y_by_default&returnUrl=${returnUrl}`;

    return `<typo3-backend-contextual-record-edit-trigger url="${escapeHtml(contextualHref)}" edit-url="${escapeHtml(editHref)}"
               class="${linkClasses}">${label}</typo3-backend-contextual-record-edit-trigger>`;
  }

  return `<a href="${escapeHtml(editHref)}"
               class="${linkClasses}">${label}</a>`;
}

// A per-task collapsible panel, TYPO3's own accordion pattern (see core's
// ContentElement/ElementInformation.html panel-heading/panel-collapse markup).
// Its header is just the task description — the editor/developer distinction
// is handled by the view tabs, not a per-row badge.
export function renderIssueCard(issue: AccessibilityIssue, classifier: ViolationClassifier, panelId: string): string {
  const classification: Classification = classifier.classify(issue);
  const contentElementLink =
    classification.contentElementUid !== undefined ? buildContentElementEditLink(classification.contentElementUid) : '';

  const nodes = issue.nodes
    .map((node) => `<a11y-code-viewer class="mb-1">${escapeHtml(node.html)}</a11y-code-viewer>`)
    .join('');

  return `<div class="panel panel-default mb-1" data-impact="${escapeHtml(issue.impact)}" data-responsibility="${escapeHtml(classification.responsibility)}">
        <div class="panel-heading" role="tab">
            <div class="panel-heading-row">
                <button class="panel-button collapsed" type="button" data-bs-toggle="collapse"
                        data-bs-target="#${panelId}" aria-controls="${panelId}" aria-expanded="false">
                    <span class="panel-title">${escapeHtml(issue.help)}</span>
                    <span class="caret"></span>
                </button>
            </div>
        </div>
        <div id="${panelId}" class="panel-collapse collapse" role="tabpanel">
            <div class="panel-body">
                <p class="card-text">${escapeHtml(issue.description)}</p>
                <p class="card-text text-body-secondary small">${escapeHtml(classification.hint)}</p>
                <a href="${escapeHtml(issue.helpUrl)}" target="_blank" rel="noopener noreferrer"
                   class="btn btn-sm btn-default mb-2 d-inline-block" title="${escapeHtml(getLabel('module.results.violations'))}">
                    <span aria-hidden="true">?</span>
                    <span class="visually-hidden">${escapeHtml(issue.help)}</span>
                </a>
                ${contentElementLink}
                ${nodes}
            </div>
        </div>
    </div>`;
}

// A per-severity group of tasks, mirroring TYPO3's RecordList table collapse
// (recordlist-heading + collapse target per content type). Expanded by
// default so task titles are visible at a glance; each task's own detail
// panel stays collapsed until clicked.
function renderSeverityGroup(
  level: string,
  issues: AccessibilityIssue[],
  groupId: string,
  classifier: ViolationClassifier,
): string {
  if (issues.length === 0) {
    return '';
  }

  const items = issues.map((issue, index) => renderIssueCard(issue, classifier, `${groupId}-issue-${index}`)).join('');

  return `<div class="panel ${severityPanelClass(level)} mb-2" data-severity-group="${level}">
        <div class="panel-heading" role="tab">
            <div class="panel-heading-row">
                <button class="panel-button" type="button" data-bs-toggle="collapse"
                        data-bs-target="#${groupId}" aria-controls="${groupId}" aria-expanded="true">
                    <span class="panel-title">${escapeHtml(getLabel(`module.filters.severity.${level}`))}</span>
                    <span class="badge text-bg-light ms-1" data-severity-group-count>${issues.length}</span>
                    <span class="caret"></span>
                </button>
            </div>
        </div>
        <div id="${groupId}" class="panel-collapse collapse show" role="tabpanel">
            <div class="panel-body p-0">
                ${items}
            </div>
        </div>
    </div>`;
}

export function renderIssueSection(
  issues: AccessibilityIssue[],
  headingId: string,
  headingLabel: string,
  badgeClass: string,
  badgeId: string,
  classifier: ViolationClassifier,
  headingInfoHtml = '',
): string {
  const sectionId = headingId.replace(/-heading$/, '');
  const groups =
    issues.length === 0
      ? `<p class="text-body-secondary">${getLabel('module.results.empty')}</p>`
      : SEVERITY_LEVELS.map((level) =>
          renderSeverityGroup(
            level,
            issues.filter((issue) => issue.impact === level),
            `${sectionId}-group-${level}`,
            classifier,
          ),
        ).join('');

  return `<section class="mb-4" aria-labelledby="${headingId}">
        <h2 id="${headingId}" class="h4 mb-3">
            ${headingLabel}
            <span class="badge ${badgeClass} ms-1" id="${badgeId}">${issues.length}</span>
        </h2>
        ${headingInfoHtml}
        ${groups}
    </section>`;
}

export function renderResults(container: HTMLElement, result: ScanResult, classifier: ViolationClassifier): void {
  const successCallout =
    result.violations.length === 0 && result.incomplete.length === 0
      ? `<div class="callout callout-success mb-4"><div class="callout-body"><p>${getLabel('module.results.empty')}</p></div></div>`
      : '';

  const incompleteInfoCallout = `<div class="callout callout-info mb-3"><div class="callout-body"><p>${getLabel('module.results.incomplete.info')}</p></div></div>`;

  container.innerHTML = `
        ${successCallout}
        ${renderIssueSection(result.violations, 'a11y-violations-heading', getLabel('module.results.violations'), 'text-bg-danger', 'a11y-violations-count', classifier)}
        <hr class="my-4">
        ${renderIssueSection(result.incomplete, 'a11y-incomplete-heading', getLabel('module.results.incomplete'), 'text-bg-warning', 'a11y-incomplete-count', classifier, incompleteInfoCallout)}`;

  updateFilterCounts(container);
  applyFilters(container);
}

function getActiveResponsibilityView(): 'editor' | 'developer' {
  const activeTab = document.querySelector<HTMLElement>('[role="tab"][data-view][aria-selected="true"]');
  return activeTab?.dataset['view'] === 'developer' ? 'developer' : 'editor';
}

// The severity toggle is a `.btn-check` input with a `.btn` label, TYPO3's own
// pattern for button-styled options (see core's clipboard/localization panels).
// Its "on" look is the label's real severity color class; "off" (including
// disabled — a severity with zero findings in the active view) falls back to
// the neutral `btn-default`, so a disabled button never looks clickable.
function syncToggleActiveState(input: HTMLInputElement): void {
  const label = document.querySelector<HTMLElement>(`label[for="${input.id}"]`);
  const btnClass = label?.dataset['btnClass'];
  if (label === null || label === undefined || btnClass === undefined) {
    return;
  }

  const isActive = input.checked && !input.disabled;
  label.classList.toggle(btnClass, isActive);
  label.classList.toggle('btn-default', !isActive);
}

// Severity counts/toggles are scoped to the active view tab: editors and
// developers each see counts for only the findings assigned to them. The view
// tab counts themselves stay totals across both, so each tab shows how many
// findings it holds overall.
export function updateFilterCounts(container: HTMLElement): void {
  const activeView = getActiveResponsibilityView();
  const severityCounts: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const viewCounts: Record<'editor' | 'developer', number> = { editor: 0, developer: 0 };

  container.querySelectorAll<HTMLElement>('[data-impact]').forEach((card) => {
    const impact = card.dataset['impact'] ?? '';
    const responsibility = card.dataset['responsibility'] === 'editor' ? 'editor' : 'developer';
    viewCounts[responsibility] += 1;

    if (responsibility === activeView && impact in severityCounts) {
      severityCounts[impact] += 1;
    }
  });

  Object.entries(severityCounts).forEach(([impact, count]) => {
    const countEl = document.querySelector(`[data-severity-count="${impact}"]`);
    if (countEl !== null) {
      countEl.textContent = String(count);
    }

    const checkbox = document.getElementById(`a11y-filter-severity-${impact}`) as HTMLInputElement | null;
    if (checkbox !== null) {
      checkbox.disabled = count === 0;
      syncToggleActiveState(checkbox);
    }
  });

  (Object.keys(viewCounts) as Array<'editor' | 'developer'>).forEach((view) => {
    const countEl = document.querySelector(`[data-view-count="${view}"]`);
    if (countEl !== null) {
      countEl.textContent = String(viewCounts[view]);
    }
  });
}

function getActiveSeverityFilters(): Set<string> {
  const checkboxes = document.querySelectorAll<HTMLInputElement>('.a11y-filter-severity');
  return new Set(
    Array.from(checkboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value),
  );
}

function updateResultCounts(container: HTMLElement): void {
  const countVisible = (headingId: string): number =>
    container.querySelectorAll(`[aria-labelledby="${headingId}"] [data-impact]:not(.d-none)`).length;

  const violationsBadge = document.getElementById('a11y-violations-count');
  if (violationsBadge !== null) {
    violationsBadge.textContent = String(countVisible('a11y-violations-heading'));
  }

  const incompleteBadge = document.getElementById('a11y-incomplete-count');
  if (incompleteBadge !== null) {
    incompleteBadge.textContent = String(countVisible('a11y-incomplete-heading'));
  }
}

export function applyFilters(container: HTMLElement): void {
  const activeSeverities = getActiveSeverityFilters();
  const activeView = getActiveResponsibilityView();

  container.querySelectorAll<HTMLElement>('[data-severity-group]').forEach((group) => {
    const severityActive = activeSeverities.has(group.dataset['severityGroup'] ?? '');
    let visibleCount = 0;

    group.querySelectorAll<HTMLElement>('[data-impact]').forEach((card) => {
      const matchesView =
        activeView === 'developer'
          ? card.dataset['responsibility'] !== 'editor'
          : card.dataset['responsibility'] === 'editor';
      const visible = severityActive && matchesView;
      card.classList.toggle('d-none', !visible);
      if (visible) {
        visibleCount += 1;
      }
    });

    group.classList.toggle('d-none', visibleCount === 0);
    const countBadge = group.querySelector('[data-severity-group-count]');
    if (countBadge !== null) {
      countBadge.textContent = String(visibleCount);
    }
  });

  updateResultCounts(container);
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

  document.querySelectorAll<HTMLInputElement>('.a11y-filter-severity').forEach((filterInput) => {
    syncToggleActiveState(filterInput);
    filterInput.addEventListener('change', () => {
      syncToggleActiveState(filterInput);
      applyFilters(resultsContainer);
    });
  });

  const viewTabs = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"][data-view]'));
  const activateViewTab = (tab: HTMLElement): void => {
    viewTabs.forEach((otherTab) => {
      const isActive = otherTab === tab;
      otherTab.setAttribute('aria-selected', String(isActive));
      otherTab.setAttribute('tabindex', isActive ? '0' : '-1');
      otherTab.classList.toggle('active', isActive);
    });
    resultsContainer.setAttribute('aria-labelledby', tab.id);
    updateFilterCounts(resultsContainer);
    applyFilters(resultsContainer);
  };

  viewTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateViewTab(tab));
    tab.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      let targetIndex: number | null = null;
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        targetIndex = (index + 1) % viewTabs.length;
      } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
        targetIndex = (index - 1 + viewTabs.length) % viewTabs.length;
      } else if (key === 'Home') {
        targetIndex = 0;
      } else if (key === 'End') {
        targetIndex = viewTabs.length - 1;
      }

      if (targetIndex !== null) {
        event.preventDefault();
        const targetTab = viewTabs[targetIndex];
        if (targetTab !== undefined) {
          targetTab.focus();
          activateViewTab(targetTab);
        }
      }
    });
  });

  scanButton.addEventListener('click', executeScan);
  executeScan();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
