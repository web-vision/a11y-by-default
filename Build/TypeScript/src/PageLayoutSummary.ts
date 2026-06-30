import { AxeEngine } from './engines/AxeEngine';
import type { ScanResult } from './types';

interface SummarySettings {
    pageUid: number;
    previewUri: string;
    axeJsUrl: string;
    moduleUrl: string;
}

export function readSettings(): SummarySettings | null {
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

function lll(key: string): string {
    const typo3 = (window as unknown as Record<string, unknown>).TYPO3 as
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

function showLoading(container: HTMLElement): void {
    container.innerHTML = `<typo3-backend-progress-bar
        label="${escapeHtml(lll('module.loading'))}">
    </typo3-backend-progress-bar>`;
}

function showError(container: HTMLElement, message: string): void {
    container.innerHTML = `<div class="callout callout-danger">
        <div class="callout-body"><p>${escapeHtml(message)}</p></div>
    </div>`;
}

export function countByImpact(issues: ScanResult['violations']): Record<string, number> {
    const counts: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const issue of issues) {
        if (issue.impact in counts) {
            counts[issue.impact]++;
        }
    }
    return counts;
}

export function renderSummary(container: HTMLElement, result: ScanResult, moduleUrl: string): void {
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

    const badgeMap: Record<string, string> = {
        critical: 'text-bg-danger',
        serious: 'text-bg-warning',
        moderate: 'text-bg-info',
        minor: 'text-bg-secondary',
    };
    const counts = countByImpact(result.violations);

    const violationBadges = Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([impact, count]) =>
            `<span class="badge ${badgeMap[impact]}">${count}&times; ${escapeHtml(impact)}</span>`,
        )
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

export async function runAutoScan(): Promise<void> {
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
        await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(
                () => reject(new Error('Iframe load timeout after 30s')),
                30000,
            );
            iframe.addEventListener('load', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
            iframe.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error('Iframe failed to load')); }, { once: true });
        });

        const engine = new AxeEngine(iframe, settings.axeJsUrl);
        const result = await engine.run();
        renderSummary(container, result, settings.moduleUrl);
    } catch (error) {
        showError(
            container,
            error instanceof Error ? error.message : lll('module.error.scanFailed'),
        );
    } finally {
        iframe.remove();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAutoScan);
} else {
    runAutoScan();
}
