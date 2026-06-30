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

class HtmlCsEngine {
    constructor(iframe, htmlcsJsUrl) {
        this.iframe = iframe;
        this.htmlcsJsUrl = htmlcsJsUrl;
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
                },
            ],
        }));
    }
}
HtmlCsEngine.STANDARD = 'WCAG2AA';

class ViolationClassifier {
    constructor(contentMetadata, rules) {
        this.contentMetadata = contentMetadata;
        this.rules = rules;
    }
    classify(violation) {
        const rule = this.rules[violation.id];
        if (rule === undefined) {
            return { responsibility: 'unknown', hint: 'This issue requires investigation by a developer.' };
        }
        const classification = { responsibility: rule.responsibility, hint: rule.hint };
        if (rule.responsibility === 'editor') {
            const uid = this.findAffectedContentElement(violation);
            if (uid !== undefined) {
                classification.contentElementUid = uid;
            }
        }
        return classification;
    }
    findAffectedContentElement(violation) {
        for (const node of violation.nodes) {
            for (const target of node.target) {
                const uid = this.extractContentElementUid(target);
                if (uid !== undefined) {
                    return uid;
                }
            }
        }
        return undefined;
    }
    extractContentElementUid(selector) {
        const match = selector.match(/#c(\d+)/);
        if (match === null) {
            return undefined;
        }
        const uid = parseInt(match[1], 10);
        const exists = this.contentMetadata.some((item) => item.uid === uid);
        return exists ? uid : undefined;
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
function impactBadgeClass(impact) {
    const map = {
        critical: 'danger',
        serious: 'warning',
        moderate: 'info',
        minor: 'secondary',
    };
    return `badge text-bg-${map[impact] ?? 'secondary'}`;
}
function responsibilityBadgeClass(responsibility) {
    return responsibility === 'editor' ? 'badge text-bg-primary' : 'badge text-bg-secondary';
}
function renderIssueCard(issue, classifier) {
    const classification = classifier.classify(issue);
    const responsibilityLabel = getLabel(`module.responsibility.${classification.responsibility}`);
    const contentElementLink = classification.contentElementUid !== undefined
        ? `<a href="/typo3/record/edit?edit[tt_content][${classification.contentElementUid}]=edit&returnUrl=."
                   class="btn btn-sm btn-default mb-2 d-inline-block">Edit content element #${classification.contentElementUid}</a>`
        : '';
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
function renderIssueSection(issues, headingId, headingLabel, badgeClass, classifier) {
    const cards = issues.length === 0
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
function renderResults(container, result, classifier) {
    const successCallout = result.violations.length === 0
        ? `<div class="callout callout-success mb-4"><div class="callout-body"><p>${getLabel('module.results.empty')}</p></div></div>`
        : '';
    container.innerHTML = `
        ${successCallout}
        ${renderIssueSection(result.violations, 'a11y-violations-heading', getLabel('module.results.violations'), 'text-bg-danger', classifier)}
        ${renderIssueSection(result.incomplete, 'a11y-incomplete-heading', getLabel('module.results.incomplete'), 'text-bg-warning', classifier)}`;
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
        const classifier = new ViolationClassifier(settings.contentMetadata, settings.classificationRules);
        const scanEngine = engine === 'axe' ? new AxeEngine(iframe, settings.axeJsUrl) : new HtmlCsEngine(iframe, settings.htmlcsJsUrl);
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
    scanButton.addEventListener('click', executeScan);
    executeScan();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
}
else {
    initialize();
}

export { initialize, renderIssueCard, renderIssueSection, renderResults };
//# sourceMappingURL=a11y-module.js.map
