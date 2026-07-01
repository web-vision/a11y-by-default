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
        return iframeWindow.axe.run(iframeWindow.document);
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
            iframeWindow.HTMLCS.process(HtmlCsEngine.STANDARD, iframeWindow.document, () => {
                const messages = iframeWindow.HTMLCS?.getMessages() ?? [];
                resolve(messages);
            });
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

function readSettings() {
    const appEl = document.getElementById('a11y-app');
    if (appEl === null) {
        return null;
    }
    const typo3Settings = window.TYPO3;
    return {
        pageUid: parseInt(appEl.dataset['pageUid'] ?? '0', 10),
        previewUri: appEl.dataset['previewUri'] ?? '',
        contentMetadata: JSON.parse(appEl.dataset['contentMetadata'] ?? '[]'),
        contentFacts: JSON.parse(appEl.dataset['contentFacts'] ?? '{}'),
        axeJsUrl: appEl.dataset['axeJsUrl'] ?? '',
        htmlcsJsUrl: appEl.dataset['htmlcsJsUrl'] ?? '',
        classificationRules: typo3Settings?.settings?.a11yByDefault?.classificationRules ?? {},
    };
}
function showLoading(container) {
    container.innerHTML = `<typo3-backend-progress-bar
        label="${escapeHtml(getLabel('module.loading'))}">
    </typo3-backend-progress-bar>`;
}
function showError(container, message) {
    container.innerHTML = `<div class="callout callout-danger a11y-error" role="alert">
        <div class="callout-body"><p>${escapeHtml(message)}</p></div>
    </div>`;
}
function getLabel(key) {
    const typo3 = window.TYPO3;
    return typo3?.lang?.[key] ?? key;
}
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
function severityPanelClass(impact) {
    return `panel-${SEVERITY_COLORS[impact] ?? 'secondary'}`;
}
const SEVERITY_LEVELS = ['critical', 'serious', 'moderate', 'minor'];
// The module runs inside the backend's content iframe. Only the outer/top backend
// document carries a valid, signed route token for record/edit (set by TYPO3's
// BackendController as TYPO3.settings.FormEngine.moduleUrl) — the same base URL
// TYPO3 core itself reuses in multi-record-selection-edit-action.js. Minting a
// token client-side is not possible, so this pre-tokenized URL must be extended.
function getRecordEditModuleUrl() {
    const topWindow = (window.top ?? window);
    const typo3 = topWindow['TYPO3'];
    return typo3?.settings?.FormEngine?.moduleUrl;
}
// The contextual (side-panel) edit route is only available from TYPO3 v14 onward.
// A11yController only emits this setting when the route exists on the running core.
function getContextualEditModuleUrl() {
    const typo3 = window.TYPO3;
    return typo3?.settings?.a11yByDefault?.contextualEditModuleUrl;
}
function buildContentElementEditLink(contentElementUid) {
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
// A per-task collapsible panel, TYPO3's own accordion pattern (see core's
// ContentElement/ElementInformation.html panel-heading/panel-collapse markup).
// Its header is just the task description — the editor/developer distinction
// is handled by the view tabs, not a per-row badge.
function renderIssueCard(issue, classifier, panelId) {
    const classification = classifier.classify(issue);
    const contentElementLink = classification.contentElementUid !== undefined ? buildContentElementEditLink(classification.contentElementUid) : '';
    const nodes = issue.nodes.map((node) => `<pre class="mb-1"><code>${escapeHtml(node.html)}</code></pre>`).join('');
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
function renderSeverityGroup(level, issues, groupId, classifier) {
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
function renderIssueSection(issues, headingId, headingLabel, badgeClass, badgeId, classifier) {
    const sectionId = headingId.replace(/-heading$/, '');
    const groups = issues.length === 0
        ? `<p class="text-body-secondary">${getLabel('module.results.empty')}</p>`
        : SEVERITY_LEVELS.map((level) => renderSeverityGroup(level, issues.filter((issue) => issue.impact === level), `${sectionId}-group-${level}`, classifier)).join('');
    return `<section class="mb-4" aria-labelledby="${headingId}">
        <h2 id="${headingId}" class="h4 mb-3">
            ${headingLabel}
            <span class="badge ${badgeClass} ms-1" id="${badgeId}">${issues.length}</span>
        </h2>
        ${groups}
    </section>`;
}
function renderResults(container, result, classifier) {
    const successCallout = result.violations.length === 0
        ? `<div class="callout callout-success mb-4"><div class="callout-body"><p>${getLabel('module.results.empty')}</p></div></div>`
        : '';
    const incompleteInfoCallout = `<div class="callout callout-info mb-3"><div class="callout-body"><p>${getLabel('module.results.incomplete.info')}</p></div></div>`;
    container.innerHTML = `
        ${successCallout}
        ${renderIssueSection(result.violations, 'a11y-violations-heading', getLabel('module.results.violations'), 'text-bg-danger', 'a11y-violations-count', classifier)}
        ${incompleteInfoCallout}
        ${renderIssueSection(result.incomplete, 'a11y-incomplete-heading', getLabel('module.results.incomplete'), 'text-bg-warning', 'a11y-incomplete-count', classifier)}`;
    updateFilterCounts(container);
    applyFilters(container);
}
function updateFilterCounts(container) {
    const severityCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    const viewCounts = { editor: 0, developer: 0 };
    container.querySelectorAll('[data-impact]').forEach((card) => {
        const impact = card.dataset['impact'] ?? '';
        if (impact in severityCounts) {
            severityCounts[impact] += 1;
        }
        viewCounts[card.dataset['responsibility'] === 'editor' ? 'editor' : 'developer'] += 1;
    });
    Object.entries(severityCounts).forEach(([impact, count]) => {
        const countEl = document.querySelector(`[data-severity-count="${impact}"]`);
        if (countEl !== null) {
            countEl.textContent = String(count);
        }
        const checkbox = document.getElementById(`a11y-filter-severity-${impact}`);
        if (checkbox !== null) {
            checkbox.disabled = count === 0;
        }
    });
    Object.keys(viewCounts).forEach((view) => {
        const countEl = document.querySelector(`[data-view-count="${view}"]`);
        if (countEl !== null) {
            countEl.textContent = String(viewCounts[view]);
        }
    });
}
function getActiveSeverityFilters() {
    const checkboxes = document.querySelectorAll('.a11y-filter-severity');
    return new Set(Array.from(checkboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value));
}
function getActiveResponsibilityView() {
    const activeTab = document.querySelector('[role="tab"][data-view][aria-selected="true"]');
    return activeTab?.dataset['view'] === 'developer' ? 'developer' : 'editor';
}
// The severity toggle is a `.btn-check` input with a `.btn` label, TYPO3's own
// pattern for button-styled options (see core's clipboard/localization panels).
// Its "on" look is the label's real severity color class; "off" falls back to
// the neutral `btn-default` — both are TYPO3-themed, so no custom CSS is needed.
function syncToggleActiveState(input) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    const btnClass = label?.dataset['btnClass'];
    if (label === null || label === undefined || btnClass === undefined) {
        return;
    }
    label.classList.toggle(btnClass, input.checked);
    label.classList.toggle('btn-default', !input.checked);
}
function updateResultCounts(container) {
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
function applyFilters(container) {
    const activeSeverities = getActiveSeverityFilters();
    const activeView = getActiveResponsibilityView();
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
    updateResultCounts(container);
}
async function runScan(settings, engine, resultsContainer) {
    const iframe = document.createElement('iframe');
    iframe.src = settings.previewUri;
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.title = 'Accessibility scan preview';
    document.body.appendChild(iframe);
    try {
        await new Promise((resolve, reject) => {
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
        const contentFactsIndex = buildContentFactsIndex(settings.contentFacts);
        const classifier = new ViolationClassifier(settings.classificationRules);
        const scanEngine = engine === 'axe'
            ? new AxeEngine(iframe, settings.axeJsUrl, contentFactsIndex)
            : new HtmlCsEngine(iframe, settings.htmlcsJsUrl, contentFactsIndex);
        const result = await scanEngine.run();
        renderResults(resultsContainer, result, classifier);
    }
    finally {
        iframe.remove();
    }
}
function initialize() {
    const settings = readSettings();
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
        showError(resultsContainer, getLabel('module.error.noPreview'));
        return;
    }
    const executeScan = async () => {
        const engine = (engineSelect?.value ?? 'axe');
        scanButton.setAttribute('disabled', 'disabled');
        showLoading(resultsContainer);
        try {
            await runScan(settings, engine, resultsContainer);
        }
        catch (error) {
            showError(resultsContainer, error instanceof Error ? error.message : getLabel('module.error.scanFailed'));
        }
        finally {
            scanButton.removeAttribute('disabled');
        }
    };
    document.querySelectorAll('.a11y-filter-severity').forEach((filterInput) => {
        syncToggleActiveState(filterInput);
        filterInput.addEventListener('change', () => {
            syncToggleActiveState(filterInput);
            applyFilters(resultsContainer);
        });
    });
    const viewTabs = Array.from(document.querySelectorAll('[role="tab"][data-view]'));
    const activateViewTab = (tab) => {
        viewTabs.forEach((otherTab) => {
            const isActive = otherTab === tab;
            otherTab.setAttribute('aria-selected', String(isActive));
            otherTab.setAttribute('tabindex', isActive ? '0' : '-1');
            otherTab.classList.toggle('active', isActive);
        });
        resultsContainer.setAttribute('aria-labelledby', tab.id);
        applyFilters(resultsContainer);
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
    scanButton.addEventListener('click', executeScan);
    executeScan();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
}
else {
    initialize();
}

export { applyFilters, initialize, renderIssueCard, renderIssueSection, renderResults, updateFilterCounts };
//# sourceMappingURL=a11y-module.js.map
