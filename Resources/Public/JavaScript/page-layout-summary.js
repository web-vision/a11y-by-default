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
    const appEl = document.getElementById('a11y-page-summary-app');
    if (appEl === null) {
        return null;
    }
    return {
        pageUid: parseInt(appEl.dataset['pageUid'] ?? '0', 10),
        previewUri: appEl.dataset['previewUri'] ?? '',
        axeJsUrl: appEl.dataset['axeJsUrl'] ?? '',
        moduleUrl: appEl.dataset['moduleUrl'] ?? '',
        contentFacts: JSON.parse(appEl.dataset['contentFacts'] ?? '{}'),
        classificationRules: JSON.parse(appEl.dataset['classificationRules'] ?? '{}'),
        hasDeveloperCornerAccess: appEl.dataset['hasDeveloperCornerAccess'] === '1',
    };
}
// Editors without developer corner access must only see issues they can actually
// act on in this summary — developer-only (and unclassified) findings are hidden,
// mirroring the view-tab filtering in the full module (see FilterController).
function filterForAccess(issues, classifier, hasDeveloperCornerAccess) {
    if (hasDeveloperCornerAccess) {
        return issues;
    }
    return issues.filter((issue) => classifier.classify(issue).responsibility === 'editor');
}
function lll(key) {
    const typo3 = window.TYPO3;
    return typo3?.lang?.[key] ?? key;
}
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function showLoading(container) {
    container.innerHTML = `<typo3-backend-progress-bar
        label="${escapeHtml(lll('module.loading'))}">
    </typo3-backend-progress-bar>`;
}
function showError(container, message) {
    container.innerHTML = `<div class="callout callout-danger">
        <div class="callout-body"><p>${escapeHtml(message)}</p></div>
    </div>`;
}
function countByImpact(issues) {
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const issue of issues) {
        if (issue.impact in counts) {
            counts[issue.impact]++;
        }
    }
    return counts;
}
function renderSummary(container, result, moduleUrl) {
    const totalViolations = result.violations.length;
    const totalIncomplete = result.incomplete.length;
    if (totalViolations === 0 && totalIncomplete === 0) {
        container.innerHTML = `<div class="callout callout-success">
            <div class="callout-body d-flex align-items-center gap-3 flex-wrap">
                <span>${escapeHtml(lll('module.results.empty'))}</span>
                <a href="${escapeHtml(moduleUrl)}" class="btn btn-sm btn-default"><typo3-backend-icon identifier="ext-a11y_by_default-check-accessibility" size="small"></typo3-backend-icon> ${escapeHtml(lll('pageHint.label'))}</a>
            </div>
        </div>`;
        return;
    }
    const badgeMap = {
        critical: 'text-bg-danger',
        serious: 'text-bg-warning',
        moderate: 'text-bg-info',
        minor: 'text-bg-secondary',
    };
    const counts = countByImpact(result.violations);
    const violationBadges = Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([impact, count]) => `<span class="badge ${badgeMap[impact]}">${count}&times; ${escapeHtml(impact)}</span>`)
        .join(' ');
    const incompleteBadge = totalIncomplete > 0
        ? ` <span class="badge text-bg-secondary">${totalIncomplete}&times; ${escapeHtml(lll('module.results.incomplete'))}</span>`
        : '';
    container.innerHTML = `<div class="callout callout-warning">
        <div class="callout-body d-flex align-items-center gap-3 flex-wrap">
            <span class="d-flex gap-1 flex-wrap">${violationBadges}${incompleteBadge}</span>
            <a href="${escapeHtml(moduleUrl)}" class="btn btn-sm btn-default"><typo3-backend-icon identifier="ext-a11y_by_default-check-accessibility" size="small"></typo3-backend-icon> ${escapeHtml(lll('pageHint.label'))}</a>
        </div>
    </div>`;
}
async function runAutoScan() {
    const settings = readSettings();
    if (settings === null || settings.pageUid === 0 || settings.previewUri === '') {
        return;
    }
    const container = document.getElementById('a11y-page-summary-app');
    if (container === null) {
        return;
    }
    showLoading(container);
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
        const engine = new AxeEngine(iframe, settings.axeJsUrl, contentFactsIndex);
        const result = await engine.run();
        const classifier = new ViolationClassifier(settings.classificationRules);
        const visibleResult = {
            ...result,
            violations: filterForAccess(result.violations, classifier, settings.hasDeveloperCornerAccess),
            incomplete: filterForAccess(result.incomplete, classifier, settings.hasDeveloperCornerAccess),
        };
        renderSummary(container, visibleResult, settings.moduleUrl);
    }
    catch (error) {
        showError(container, error instanceof Error ? error.message : lll('module.error.scanFailed'));
    }
    finally {
        iframe.remove();
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAutoScan);
}
else {
    runAutoScan();
}

export { countByImpact, filterForAccess, readSettings, renderSummary, runAutoScan };
//# sourceMappingURL=page-layout-summary.js.map
