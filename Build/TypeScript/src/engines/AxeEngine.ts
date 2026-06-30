import type { AccessibilityIssue, IssueNode, ScanResult } from '../types';

interface AxeNode {
    html: string;
    target: string[];
    failureSummary?: string;
}

interface AxeResult {
    id: string;
    impact: string | null;
    description: string;
    help: string;
    helpUrl: string;
    tags: string[];
    nodes: AxeNode[];
}

interface AxeResults {
    violations: AxeResult[];
    incomplete: AxeResult[];
    passes: AxeResult[];
    url: string;
}

interface AxeWindow extends Window {
    axe?: {
        run(context: Document): Promise<AxeResults>;
    };
}

export class AxeEngine {
    constructor(
        private readonly iframe: HTMLIFrameElement,
        private readonly axeJsUrl: string,
    ) {}

    async run(): Promise<ScanResult> {
        await this.injectScript(this.axeJsUrl);
        const results = await this.executeAxe();

        return {
            violations: this.normalizeResults(results.violations),
            incomplete: this.normalizeResults(results.incomplete),
            passes: this.normalizeResults(results.passes),
            url: results.url,
        };
    }

    private injectScript(src: string): Promise<void> {
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

    private async executeAxe(): Promise<AxeResults> {
        const iframeWindow = this.iframe.contentWindow as AxeWindow | null;
        if (iframeWindow?.axe === undefined) {
            throw new Error('axe-core not available in iframe');
        }

        return iframeWindow.axe.run(iframeWindow.document);
    }

    private normalizeResults(results: AxeResult[]): AccessibilityIssue[] {
        return results.map((result): AccessibilityIssue => ({
            id: result.id,
            impact: result.impact ?? 'minor',
            description: result.description,
            help: result.help,
            helpUrl: result.helpUrl,
            tags: result.tags,
            nodes: result.nodes.map((node): IssueNode => ({
                html: node.html,
                target: node.target,
                failureSummary: node.failureSummary,
            })),
        }));
    }
}
