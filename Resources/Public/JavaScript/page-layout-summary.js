class AxeEngine {
    constructor(iframe, axeJsUrl) {
        this.iframe = iframe;
        this.axeJsUrl = axeJsUrl;
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
            nodes: result.nodes.map((node) => ({
                html: node.html,
                target: node.target,
                ...(node.failureSummary !== undefined ? { failureSummary: node.failureSummary } : {}),
            })),
        }));
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
    };
}
function lll(key) {
    const typo3 = window.TYPO3;
    return typo3?.lang?.[key] ?? key;
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
                <a href="${escapeHtml(moduleUrl)}" class="btn btn-sm btn-default">${escapeHtml(lll('pageHint.label'))}</a>
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
            <a href="${escapeHtml(moduleUrl)}" class="btn btn-sm btn-default">${escapeHtml(lll('pageHint.label'))}</a>
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
            iframe.addEventListener('load', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
            iframe.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error('Iframe failed to load')); }, { once: true });
        });
        const engine = new AxeEngine(iframe, settings.axeJsUrl);
        const result = await engine.run();
        renderSummary(container, result, settings.moduleUrl);
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
//# sourceMappingURL=page-layout-summary.js.map
