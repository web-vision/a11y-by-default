import { EditorView, highlightSpecialChars } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

const TAG_NAME = 'a11y-code-viewer';
const STYLE_ID = 'a11y-code-viewer-style';
// TYPO3's own <typo3-t3editor-codemirror> only exposes a `readonly` flag,
// which still leaves the field focusable with a blinking caret and focus
// ring — it reads as a disabled editor rather than a code display. Building
// directly on the CodeMirror packages TYPO3's backend already loads via its
// importmap (see EXT:backend Configuration/JavaScriptModules.php) lets us
// combine EditorState.readOnly with EditorView.editable(false), which drops
// the caret entirely instead of just rejecting edits.
class A11yCodeViewer extends HTMLElement {
    constructor() {
        super(...arguments);
        this.view = null;
        this.observer = null;
    }
    connectedCallback() {
        if (this.view !== null) {
            return;
        }
        injectStyles();
        if (typeof IntersectionObserver === 'undefined') {
            this.mount();
            return;
        }
        // Issue snippets sit inside collapsed accordion panels (zero height until
        // expanded), so mount lazily on first visibility instead of paying for a
        // CodeMirror instance per hidden issue. Matches the observer pattern
        // TYPO3 core itself uses for lazy-loaded code editors.
        this.observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.intersectionRatio > 0)) {
                this.mount();
            }
        }, { root: document.body });
        this.observer.observe(this);
    }
    disconnectedCallback() {
        this.observer?.disconnect();
        this.observer = null;
        this.view?.destroy();
        this.view = null;
    }
    mount() {
        this.observer?.disconnect();
        this.observer = null;
        const source = this.textContent ?? '';
        this.textContent = '';
        this.view = new EditorView({
            parent: this,
            state: EditorState.create({
                doc: source,
                extensions: [
                    EditorState.readOnly.of(true),
                    EditorView.editable.of(false),
                    EditorView.lineWrapping,
                    highlightSpecialChars(),
                    html(),
                    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                ],
            }),
        });
    }
}
function injectStyles() {
    if (document.getElementById(STYLE_ID) !== null) {
        return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
    ${TAG_NAME} {
      display: block;
      margin-bottom: .25rem;
    }
    ${TAG_NAME} .cm-editor {
      border: var(--typo3-input-border-width, 1px) solid var(--typo3-input-border-color, #b3b3b3);
      border-radius: var(--typo3-input-border-radius, .25rem);
      font-size: .8125rem;
    }
    ${TAG_NAME} .cm-scroller {
      max-height: 12rem;
    }
  `;
    document.head.appendChild(style);
}
if (customElements.get(TAG_NAME) === undefined) {
    customElements.define(TAG_NAME, A11yCodeViewer);
}

class FilterController {
    bindSeverityToggles(resultsContainer) {
        document.querySelectorAll('.a11y-filter-severity').forEach((filterInput) => {
            this.syncToggleActiveState(filterInput);
            filterInput.addEventListener('change', () => {
                this.syncToggleActiveState(filterInput);
                this.applyFilters(resultsContainer);
            });
        });
    }
    // The severity toggle is a `.btn-check` input with a `.btn` label, TYPO3's own
    // pattern for button-styled options (see core's clipboard/localization panels).
    // Its "on" look is the label's real severity color class; "off" (including
    // disabled — a severity with zero findings in the active view) falls back to
    // the neutral `btn-default`, so a disabled button never looks clickable.
    syncToggleActiveState(input) {
        const label = document.querySelector(`label[for="${input.id}"]`);
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
    updateFilterCounts(container) {
        const activeView = this.getActiveResponsibilityView();
        const severityCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        const viewCounts = { editor: 0, developer: 0 };
        container.querySelectorAll('[data-impact]').forEach((card) => {
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
            const checkbox = document.getElementById(`a11y-filter-severity-${impact}`);
            if (checkbox !== null) {
                checkbox.disabled = count === 0;
                this.syncToggleActiveState(checkbox);
            }
        });
        Object.keys(viewCounts).forEach((view) => {
            const countEl = document.querySelector(`[data-view-count="${view}"]`);
            if (countEl !== null) {
                countEl.textContent = String(viewCounts[view]);
            }
        });
    }
    applyFilters(container) {
        const activeSeverities = this.getActiveSeverityFilters();
        const activeView = this.getActiveResponsibilityView();
        container.querySelectorAll('[data-severity-group]').forEach((group) => {
            const severityActive = activeSeverities.has(group.dataset['severityGroup'] ?? '');
            let visibleCount = 0;
            group.querySelectorAll('[data-impact]').forEach((card) => {
                const matchesView = activeView === 'developer'
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
        this.updateResultCounts(container);
    }
    getActiveResponsibilityView() {
        const activeTab = document.querySelector('[role="tab"][data-view][aria-selected="true"]');
        return activeTab?.dataset['view'] === 'developer' ? 'developer' : 'editor';
    }
    getActiveSeverityFilters() {
        const checkboxes = document.querySelectorAll('.a11y-filter-severity');
        return new Set(Array.from(checkboxes)
            .filter((checkbox) => checkbox.checked)
            .map((checkbox) => checkbox.value));
    }
    updateResultCounts(container) {
        const countVisible = (headingId) => container.querySelectorAll(`[aria-labelledby="${headingId}"] [data-impact]:not(.d-none)`).length;
        const violationsBadge = document.getElementById('a11y-violations-count');
        if (violationsBadge !== null) {
            violationsBadge.textContent = String(countVisible('a11y-violations-heading'));
        }
        const incompleteBadge = document.getElementById('a11y-incomplete-count');
        if (incompleteBadge !== null) {
            incompleteBadge.textContent = String(countVisible('a11y-incomplete-heading'));
        }
    }
}

class ViewTabController {
    constructor(filterController) {
        this.filterController = filterController;
    }
    bind(resultsContainer) {
        const viewTabs = Array.from(document.querySelectorAll('[role="tab"][data-view]'));
        const activateViewTab = (tab) => {
            viewTabs.forEach((otherTab) => {
                const isActive = otherTab === tab;
                otherTab.setAttribute('aria-selected', String(isActive));
                otherTab.setAttribute('tabindex', isActive ? '0' : '-1');
                otherTab.classList.toggle('active', isActive);
            });
            resultsContainer.setAttribute('aria-labelledby', tab.id);
            this.filterController.updateFilterCounts(resultsContainer);
            this.filterController.applyFilters(resultsContainer);
        };
        viewTabs.forEach((tab, index) => {
            tab.addEventListener('click', () => activateViewTab(tab));
            tab.addEventListener('keydown', (event) => {
                const key = event.key;
                let targetIndex = null;
                if (key === 'ArrowRight' || key === 'ArrowDown') {
                    targetIndex = (index + 1) % viewTabs.length;
                }
                else if (key === 'ArrowLeft' || key === 'ArrowUp') {
                    targetIndex = (index - 1 + viewTabs.length) % viewTabs.length;
                }
                else if (key === 'Home') {
                    targetIndex = 0;
                }
                else if (key === 'End') {
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
    }
}

class Html {
    static escape(value) {
        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

// Static accessors for the backend's global TYPO3 object — the module runs
// inside the backend's content iframe and reads labels/settings TYPO3 core
// (or A11yController) already put on `window.TYPO3`.
class Typo3Backend {
    static getLabel(key) {
        const typo3 = window.TYPO3;
        return typo3?.lang?.[key] ?? key;
    }
    static getClassificationRules() {
        const typo3Settings = window.TYPO3;
        return typo3Settings?.settings?.a11yByDefault?.classificationRules ?? {};
    }
    // Only the outer/top backend document carries a valid, signed route token for
    // record/edit (set by TYPO3's BackendController as TYPO3.settings.FormEngine.moduleUrl)
    // — the same base URL TYPO3 core itself reuses in multi-record-selection-edit-action.js.
    // Minting a token client-side is not possible, so this pre-tokenized URL must be extended.
    static getRecordEditModuleUrl() {
        const topWindow = (window.top ?? window);
        const typo3 = topWindow['TYPO3'];
        return typo3?.settings?.FormEngine?.moduleUrl;
    }
    // The contextual (side-panel) edit route is only available from TYPO3 v14 onward.
    // A11yController only emits this setting when the route exists on the running core.
    static getContextualEditModuleUrl() {
        const typo3 = window.TYPO3;
        return typo3?.settings?.a11yByDefault?.contextualEditModuleUrl;
    }
}

class ContentElementEditLink {
    static build(contentElementUid) {
        const moduleUrl = Typo3Backend.getRecordEditModuleUrl();
        if (moduleUrl === undefined || moduleUrl === '') {
            return '';
        }
        const label = `Edit content element #${contentElementUid}`;
        const linkClasses = 'btn btn-sm btn-default mb-2 d-inline-block';
        const returnUrl = encodeURIComponent(window.location.href);
        const editHref = `${moduleUrl}&edit[tt_content][${contentElementUid}]=edit&module=web_a11y_by_default&returnUrl=${returnUrl}`;
        const contextualModuleUrl = Typo3Backend.getContextualEditModuleUrl();
        if (contextualModuleUrl !== undefined && contextualModuleUrl !== null && contextualModuleUrl !== '') {
            const contextualHref = `${contextualModuleUrl}&edit[tt_content][${contentElementUid}]=edit&module=web_a11y_by_default&returnUrl=${returnUrl}`;
            return `<typo3-backend-contextual-record-edit-trigger url="${Html.escape(contextualHref)}" edit-url="${Html.escape(editHref)}"
                 class="${linkClasses}">${label}</typo3-backend-contextual-record-edit-trigger>`;
        }
        return `<a href="${Html.escape(editHref)}"
                 class="${linkClasses}">${label}</a>`;
    }
}

// A per-task collapsible panel, TYPO3's own accordion pattern (see core's
// ContentElement/ElementInformation.html panel-heading/panel-collapse markup).
// Its header is just the task description — the editor/developer distinction
// is handled by the view tabs, not a per-row badge.
class IssueCardRenderer {
    constructor(classifier) {
        this.classifier = classifier;
    }
    render(issue, panelId) {
        const classification = this.classifier.classify(issue);
        const contentElementLink = classification.contentElementUid !== undefined
            ? ContentElementEditLink.build(classification.contentElementUid)
            : '';
        const nodes = issue.nodes
            .map((node) => `<a11y-code-viewer class="mb-1">${Html.escape(node.html)}</a11y-code-viewer>`)
            .join('');
        return `<div class="panel panel-default mb-1" data-impact="${Html.escape(issue.impact)}" data-responsibility="${Html.escape(classification.responsibility)}">
        <div class="panel-heading" role="tab">
            <div class="panel-heading-row">
                <button class="panel-button collapsed" type="button" data-bs-toggle="collapse"
                        data-bs-target="#${panelId}" aria-controls="${panelId}" aria-expanded="false">
                    <span class="panel-title">${Html.escape(issue.help)}</span>
                    <span class="caret"></span>
                </button>
            </div>
        </div>
        <div id="${panelId}" class="panel-collapse collapse" role="tabpanel">
            <div class="panel-body">
                <p class="card-text">${Html.escape(issue.description)}</p>
                <p class="card-text text-body-secondary small">${Html.escape(classification.hint)}</p>
                <a href="${Html.escape(issue.helpUrl)}" target="_blank" rel="noopener noreferrer"
                   class="btn btn-sm btn-default mb-2 d-inline-block" title="${Html.escape(Typo3Backend.getLabel('module.results.violations'))}">
                    <span aria-hidden="true">?</span>
                    <span class="visually-hidden">${Html.escape(issue.help)}</span>
                </a>
                ${contentElementLink}
                ${nodes}
            </div>
        </div>
    </div>`;
    }
}

// The same color family as the severity filter buttons (btn-danger/warning/
// info/secondary), applied here via TYPO3's panel-* variants so the group
// header background/text/caret pick up the matching theme-aware colors.
const SEVERITY_COLORS = {
    critical: 'danger',
    serious: 'warning',
    moderate: 'info',
    minor: 'secondary',
};
const SEVERITY_LEVELS = ['critical', 'serious', 'moderate', 'minor'];
class IssueSectionRenderer {
    constructor(cardRenderer) {
        this.cardRenderer = cardRenderer;
    }
    render(issues, headingId, headingLabel, badgeClass, badgeId, headingInfoHtml = '') {
        const sectionId = headingId.replace(/-heading$/, '');
        const groups = issues.length === 0
            ? `<p class="text-body-secondary">${Typo3Backend.getLabel('module.results.empty')}</p>`
            : SEVERITY_LEVELS.map((level) => this.renderSeverityGroup(level, issues.filter((issue) => issue.impact === level), `${sectionId}-group-${level}`)).join('');
        return `<section class="mb-4" aria-labelledby="${headingId}">
        <h2 id="${headingId}" class="h4 mb-3">
            ${headingLabel}
            <span class="badge ${badgeClass} ms-1" id="${badgeId}">${issues.length}</span>
        </h2>
        ${headingInfoHtml}
        ${groups}
    </section>`;
    }
    // A per-severity group of tasks, mirroring TYPO3's RecordList table collapse
    // (recordlist-heading + collapse target per content type). Expanded by
    // default so task titles are visible at a glance; each task's own detail
    // panel stays collapsed until clicked.
    renderSeverityGroup(level, issues, groupId) {
        if (issues.length === 0) {
            return '';
        }
        const items = issues.map((issue, index) => this.cardRenderer.render(issue, `${groupId}-issue-${index}`)).join('');
        return `<div class="panel ${this.severityPanelClass(level)} mb-2" data-severity-group="${level}">
        <div class="panel-heading" role="tab">
            <div class="panel-heading-row">
                <button class="panel-button" type="button" data-bs-toggle="collapse"
                        data-bs-target="#${groupId}" aria-controls="${groupId}" aria-expanded="true">
                    <span class="panel-title">${Html.escape(Typo3Backend.getLabel(`module.filters.severity.${level}`))}</span>
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
    severityPanelClass(impact) {
        return `panel-${SEVERITY_COLORS[impact] ?? 'secondary'}`;
    }
}

class ResultsRenderer {
    constructor(classifier, filterController) {
        this.filterController = filterController;
        this.sectionRenderer = new IssueSectionRenderer(new IssueCardRenderer(classifier));
    }
    render(container, result) {
        const successCallout = result.violations.length === 0 && result.incomplete.length === 0
            ? `<div class="callout callout-success mb-4"><div class="callout-body"><p>${Typo3Backend.getLabel('module.results.empty')}</p></div></div>`
            : '';
        const incompleteInfoCallout = `<div class="callout callout-info mb-3"><div class="callout-body"><p>${Typo3Backend.getLabel('module.results.incomplete.info')}</p></div></div>`;
        container.innerHTML = `
        ${successCallout}
        ${this.sectionRenderer.render(result.violations, 'a11y-violations-heading', Typo3Backend.getLabel('module.results.violations'), 'text-bg-danger', 'a11y-violations-count')}
        <hr class="my-4">
        ${this.sectionRenderer.render(result.incomplete, 'a11y-incomplete-heading', Typo3Backend.getLabel('module.results.incomplete'), 'text-bg-warning', 'a11y-incomplete-count', incompleteInfoCallout)}`;
        this.filterController.updateFilterCounts(container);
        this.filterController.applyFilters(container);
    }
}

class StatusView {
    static showLoading(container) {
        container.innerHTML = `<typo3-backend-progress-bar
          label="${Html.escape(Typo3Backend.getLabel('module.loading'))}">
      </typo3-backend-progress-bar>`;
    }
    static showError(container, message) {
        container.innerHTML = `<div class="callout callout-danger a11y-error" role="alert">
          <div class="callout-body"><p>${Html.escape(message)}</p></div>
      </div>`;
    }
}

const EMPTY_CONTENT_FACTS_INDEX = { headings: [], links: [], images: [], tables: [] };
function buildContentFactsIndex(facts) {
    const index = { headings: [], links: [], images: [], tables: [] };
    for (const [uidKey, elementFacts] of Object.entries(facts)) {
        const contentElementUid = Number(uidKey);
        elementFacts.headings.forEach((heading) => index.headings.push({ text: heading.text, contentElementUid }));
        elementFacts.links.forEach((link) => index.links.push({ text: link.text, href: link.href, contentElementUid }));
        elementFacts.images.forEach((image) => index.images.push({ ...image, contentElementUid }));
        elementFacts.tables.forEach((table) => index.tables.push({ ...table, contentElementUid }));
    }
    return index;
}
function normalizeText(text) {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function matchHeadingText(text, index) {
    const normalized = normalizeText(text);
    if (normalized === '') {
        return undefined;
    }
    const match = index.headings.find((heading) => normalizeText(heading.text) === normalized);
    return match?.contentElementUid;
}

function matchImageSource(srcOrHref, index) {
    const value = srcOrHref.trim();
    if (value === '') {
        return undefined;
    }
    const match = index.images.find((image) => image.matchers.some((matcher) => matcher !== '' && value.includes(matcher)));
    if (match === undefined) {
        return undefined;
    }
    return { contentElementUid: match.contentElementUid, hasAltData: match.hasAltData };
}

function matchTextAgainstKnownContent(text, index) {
    const normalized = normalizeText(text);
    if (normalized === '') {
        return undefined;
    }
    const headingMatch = index.headings.find((heading) => normalizeText(heading.text) === normalized);
    if (headingMatch !== undefined) {
        return headingMatch.contentElementUid;
    }
    const linkMatch = index.links.find((link) => normalizeText(link.text) === normalized);
    return linkMatch?.contentElementUid;
}
function matchHrefAgainstKnownLinks(href, index) {
    const value = href.trim();
    if (value === '') {
        return undefined;
    }
    const match = index.links.find((link) => link.href !== '' && (value.includes(link.href) || link.href.includes(value)));
    return match?.contentElementUid;
}
function matchLink(anchor, index) {
    const text = anchor.textContent ?? '';
    const ariaLabel = anchor.getAttribute('aria-label') ?? '';
    const textMatch = matchTextAgainstKnownContent(text, index) ?? matchTextAgainstKnownContent(ariaLabel, index);
    if (textMatch !== undefined) {
        return { contentElementUid: textMatch, hasAltData: false };
    }
    const hrefMatch = matchHrefAgainstKnownLinks(anchor.getAttribute('href') ?? '', index);
    if (hrefMatch !== undefined) {
        return { contentElementUid: hrefMatch, hasAltData: false };
    }
    const image = anchor.querySelector('img');
    return image !== null ? matchImageSource(image.getAttribute('src') ?? '', index) : undefined;
}

const OVERLAP_THRESHOLD = 0.6;
function getLiveCellTexts(table) {
    return Array.from(table.querySelectorAll('td, th'))
        .map((cell) => normalizeText(cell.textContent ?? ''))
        .filter((text) => text !== '');
}
function overlapRatio(liveCellTexts, knownCellTexts) {
    if (liveCellTexts.length === 0) {
        return 0;
    }
    const known = new Set(knownCellTexts.map((text) => normalizeText(text)));
    const overlapping = liveCellTexts.filter((text) => known.has(text)).length;
    return overlapping / liveCellTexts.length;
}
function matchTable(table, index) {
    const liveCellTexts = getLiveCellTexts(table);
    if (liveCellTexts.length === 0) {
        return undefined;
    }
    let bestUid;
    let bestRatio = OVERLAP_THRESHOLD;
    for (const fact of index.tables) {
        const ratio = overlapRatio(liveCellTexts, fact.cellTexts);
        if (ratio >= bestRatio) {
            bestRatio = ratio;
            bestUid = fact.contentElementUid;
        }
    }
    return bestUid;
}

const HEADING_RULES = new Set(['heading-order']);
const IMAGE_RULES = new Set(['image-alt', 'input-image-alt', 'area-alt']);
const LINK_RULES = new Set(['link-name']);
const TABLE_RULES = new Set(['td-headers-attr', 'th-has-data-cells']);
function resolveHeadingMatch(element, index) {
    const uid = matchHeadingText(element.textContent ?? '', index);
    return uid !== undefined ? { contentElementUid: uid } : {};
}
function resolveImageMatch(ruleId, element, index) {
    const attribute = ruleId === 'area-alt' ? 'href' : 'src';
    const match = matchImageSource(element.getAttribute(attribute) ?? '', index);
    return match !== undefined ? { contentElementUid: match.contentElementUid, dataAvailable: match.hasAltData } : {};
}
function resolveLinkMatch(element, index) {
    const match = matchLink(element, index);
    return match !== undefined ? { contentElementUid: match.contentElementUid, dataAvailable: match.hasAltData } : {};
}
function resolveTableMatch(element, index) {
    const table = element.closest('table');
    const uid = table !== null ? matchTable(table, index) : undefined;
    return uid !== undefined ? { contentElementUid: uid } : {};
}
/**
 * Dispatches to the matcher appropriate for the given axe/HTML CodeSniffer rule id, correlating the live
 * offending DOM element against known database content (see ContentFactsService on the PHP side) instead of
 * relying on any particular template's markup conventions.
 */
function resolveContentMatch(ruleId, element, index) {
    if (element === null) {
        return {};
    }
    if (HEADING_RULES.has(ruleId)) {
        return resolveHeadingMatch(element, index);
    }
    if (IMAGE_RULES.has(ruleId)) {
        return resolveImageMatch(ruleId, element, index);
    }
    if (LINK_RULES.has(ruleId)) {
        return resolveLinkMatch(element, index);
    }
    if (TABLE_RULES.has(ruleId)) {
        return resolveTableMatch(element, index);
    }
    return {};
}

/**
 * axe-core preloads the CSSOM of every stylesheet on the page (fetching cross-origin
 * ones via XHR) purely to feed the experimental "css-orientation-lock" rule. In the
 * backend preview iframe this generates a flood of failed CSS requests for
 * third-party/CDN stylesheets we have no CORS control over, so both the preload and
 * the rule are disabled here.
 */
const AXE_RUN_OPTIONS = {
    preload: { assets: ['media'] },
    rules: { 'css-orientation-lock': { enabled: false } },
};
class AxeEngine {
    constructor(iframe, axeJsUrl, contentFactsIndex = EMPTY_CONTENT_FACTS_INDEX) {
        this.iframe = iframe;
        this.axeJsUrl = axeJsUrl;
        this.contentFactsIndex = contentFactsIndex;
    }
    async run() {
        await this.injectScript(this.axeJsUrl);
        const results = await this.executeAxe();
        return {
            violations: this.normalizeResults(results.violations),
            incomplete: this.normalizeResults(results.incomplete),
            passes: this.normalizeResults(results.passes),
            url: results.url,
        };
    }
    injectScript(src) {
        return new Promise((resolve, reject) => {
            const iframeDocument = this.iframe.contentDocument;
            if (iframeDocument === null) {
                reject(new Error('Cannot access iframe document'));
                return;
            }
            const script = iframeDocument.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            iframeDocument.head.appendChild(script);
        });
    }
    async executeAxe() {
        const iframeWindow = this.iframe.contentWindow;
        if (iframeWindow?.axe === undefined) {
            throw new Error('axe-core not available in iframe');
        }
        return iframeWindow.axe.run(iframeWindow.document, AXE_RUN_OPTIONS);
    }
    normalizeResults(results) {
        return results.map((result) => ({
            id: result.id,
            impact: result.impact ?? 'minor',
            description: result.description,
            help: result.help,
            helpUrl: result.helpUrl,
            tags: result.tags,
            nodes: result.nodes.map((node) => this.normalizeNode(result.id, node)),
        }));
    }
    normalizeNode(ruleId, node) {
        const element = this.resolveElement(node.target);
        const match = resolveContentMatch(ruleId, element, this.contentFactsIndex);
        return {
            html: node.html,
            target: node.target,
            ...(node.failureSummary !== undefined ? { failureSummary: node.failureSummary } : {}),
            ...match,
        };
    }
    resolveElement(target) {
        const selector = target[target.length - 1];
        if (selector === undefined) {
            return null;
        }
        try {
            return this.iframe.contentDocument?.querySelector(selector) ?? null;
        }
        catch {
            return null;
        }
    }
}

class HtmlCsEngine {
    constructor(iframe, htmlcsJsUrl, contentFactsIndex = EMPTY_CONTENT_FACTS_INDEX) {
        this.iframe = iframe;
        this.htmlcsJsUrl = htmlcsJsUrl;
        this.contentFactsIndex = contentFactsIndex;
    }
    async run() {
        await this.injectScript(this.htmlcsJsUrl);
        const messages = await this.executeHtmlCs();
        const violations = this.normalizeMessages(messages, 1);
        const incomplete = this.normalizeMessages(messages, 2);
        const passes = [];
        return { violations, incomplete, passes, url: this.iframe.src };
    }
    injectScript(src) {
        return new Promise((resolve, reject) => {
            const iframeDocument = this.iframe.contentDocument;
            if (iframeDocument === null) {
                reject(new Error('Cannot access iframe document'));
                return;
            }
            const script = iframeDocument.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load HTMLCS: ${src}`));
            iframeDocument.head.appendChild(script);
        });
    }
    executeHtmlCs() {
        return new Promise((resolve, reject) => {
            const iframeWindow = this.iframe.contentWindow;
            if (iframeWindow?.HTMLCS === undefined) {
                reject(new Error('HTML CodeSniffer not available in iframe'));
                return;
            }
            const onDone = () => {
                const messages = iframeWindow.HTMLCS?.getMessages() ?? [];
                resolve(messages);
            };
            // HTMLCS only invokes the completion callback if `callback instanceof Function`
            // is true, checked against its own realm's Function constructor. A callback
            // created in the parent window fails that check silently (no error, no
            // console output), so the scan hangs forever. Building the callback with the
            // iframe's own Function constructor makes it pass that check.
            const callback = iframeWindow.Function('cb', 'return function () { cb(); };')(onDone);
            iframeWindow.HTMLCS.process(HtmlCsEngine.STANDARD, iframeWindow.document, callback);
        });
    }
    normalizeMessages(messages, type) {
        return messages
            .filter((msg) => msg.type === type)
            .map((msg) => ({
            id: msg.code,
            impact: type === 1 ? 'serious' : 'moderate',
            description: msg.msg,
            help: msg.msg,
            helpUrl: `https://squizlabs.github.io/HTML_CodeSniffer/Standards/WCAG2/`,
            tags: ['wcag2aa'],
            nodes: [
                {
                    html: msg.element.outerHTML ?? '',
                    target: [msg.element.tagName.toLowerCase()],
                    ...resolveContentMatch(msg.code, msg.element, this.contentFactsIndex),
                },
            ],
        }));
    }
}
HtmlCsEngine.STANDARD = 'WCAG2AA';

class ScanRunner {
    async run(settings, engine) {
        const iframe = document.createElement('iframe');
        iframe.src = settings.previewUri;
        iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.setAttribute('tabindex', '-1');
        iframe.title = 'Accessibility scan preview';
        document.body.appendChild(iframe);
        try {
            await this.waitForLoad(iframe);
            const contentFactsIndex = buildContentFactsIndex(settings.contentFacts);
            const scanEngine = engine === 'axe'
                ? new AxeEngine(iframe, settings.axeJsUrl, contentFactsIndex)
                : new HtmlCsEngine(iframe, settings.htmlcsJsUrl, contentFactsIndex);
            return await scanEngine.run();
        }
        finally {
            iframe.remove();
        }
    }
    waitForLoad(iframe) {
        return new Promise((resolve, reject) => {
            const timeout = window.setTimeout(() => reject(new Error('Iframe load timeout after 30s')), 30000);
            iframe.addEventListener('load', () => {
                window.clearTimeout(timeout);
                resolve();
            }, { once: true });
            iframe.addEventListener('error', () => {
                window.clearTimeout(timeout);
                reject(new Error('Iframe failed to load'));
            }, { once: true });
        });
    }
}

class ModuleSettingsReader {
    read() {
        const appEl = document.getElementById('a11y-app');
        if (appEl === null) {
            return null;
        }
        return {
            pageUid: parseInt(appEl.dataset['pageUid'] ?? '0', 10),
            previewUri: appEl.dataset['previewUri'] ?? '',
            contentMetadata: JSON.parse(appEl.dataset['contentMetadata'] ?? '[]'),
            contentFacts: JSON.parse(appEl.dataset['contentFacts'] ?? '{}'),
            axeJsUrl: appEl.dataset['axeJsUrl'] ?? '',
            htmlcsJsUrl: appEl.dataset['htmlcsJsUrl'] ?? '',
            classificationRules: Typo3Backend.getClassificationRules(),
        };
    }
}

class ViolationClassifier {
    constructor(rules) {
        this.rules = rules;
    }
    classify(violation) {
        const rule = this.rules[violation.id];
        if (rule === undefined) {
            return { responsibility: 'unknown', hint: 'This issue requires investigation by a developer.' };
        }
        if (rule.responsibility !== 'editor') {
            return { responsibility: 'developer', hint: rule.hint };
        }
        const match = violation.nodes.find((node) => node.contentElementUid !== undefined);
        if (match?.contentElementUid === undefined || match.dataAvailable === true) {
            return { responsibility: 'developer', hint: rule.developerHint ?? rule.hint };
        }
        return { responsibility: 'editor', hint: rule.hint, contentElementUid: match.contentElementUid };
    }
}

class A11yModule {
    constructor() {
        this.settingsReader = new ModuleSettingsReader();
        this.filterController = new FilterController();
        this.viewTabController = new ViewTabController(this.filterController);
        this.scanRunner = new ScanRunner();
    }
    initialize() {
        const settings = this.settingsReader.read();
        if (settings === null || settings.pageUid === 0) {
            return;
        }
        const resultsContainer = document.getElementById('a11y-results');
        const scanButton = document.getElementById('a11y-scan-button');
        const engineSelect = document.getElementById('a11y-engine-select');
        if (resultsContainer === null || scanButton === null) {
            return;
        }
        if (settings.previewUri === '') {
            StatusView.showError(resultsContainer, Typo3Backend.getLabel('module.error.noPreview'));
            return;
        }
        const executeScan = async () => {
            const engine = (engineSelect?.value ?? 'axe');
            scanButton.setAttribute('disabled', 'disabled');
            StatusView.showLoading(resultsContainer);
            try {
                const result = await this.scanRunner.run(settings, engine);
                const classifier = new ViolationClassifier(settings.classificationRules);
                new ResultsRenderer(classifier, this.filterController).render(resultsContainer, result);
            }
            catch (error) {
                StatusView.showError(resultsContainer, error instanceof Error ? error.message : Typo3Backend.getLabel('module.error.scanFailed'));
            }
            finally {
                scanButton.removeAttribute('disabled');
            }
        };
        this.filterController.bindSeverityToggles(resultsContainer);
        this.viewTabController.bind(resultsContainer);
        scanButton.addEventListener('click', executeScan);
        executeScan();
    }
}
function initialize() {
    new A11yModule().initialize();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
}
else {
    initialize();
}

export { A11yModule, initialize };
//# sourceMappingURL=a11y-module.js.map
