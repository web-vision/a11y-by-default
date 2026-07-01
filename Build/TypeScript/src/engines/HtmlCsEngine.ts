import { EMPTY_CONTENT_FACTS_INDEX, type ContentFactsIndex } from '../ContentFacts';
import { resolveContentMatch } from '../matchers';
import type { AccessibilityIssue, IssueNode, ScanResult } from '../types';

interface HtmlCsMessage {
  code: string;
  type: number;
  msg: string;
  element: Element;
}

interface HtmlCsWindow extends Window {
  HTMLCS?: {
    process(standard: string, document: Document, callback: () => void): void;
    getMessages(): HtmlCsMessage[];
    ERROR: number;
    WARNING: number;
    NOTICE: number;
  };
}

export class HtmlCsEngine {
  private static readonly STANDARD = 'WCAG2AA';

  constructor(
    private readonly iframe: HTMLIFrameElement,
    private readonly htmlcsJsUrl: string,
    private readonly contentFactsIndex: ContentFactsIndex = EMPTY_CONTENT_FACTS_INDEX,
  ) {}

  async run(): Promise<ScanResult> {
    await this.injectScript(this.htmlcsJsUrl);
    const messages = await this.executeHtmlCs();
    const violations = this.normalizeMessages(messages, 1);
    const incomplete = this.normalizeMessages(messages, 2);
    const passes: AccessibilityIssue[] = [];

    return { violations, incomplete, passes, url: this.iframe.src };
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
      script.onerror = () => reject(new Error(`Failed to load HTMLCS: ${src}`));
      iframeDocument.head.appendChild(script);
    });
  }

  private executeHtmlCs(): Promise<HtmlCsMessage[]> {
    return new Promise((resolve, reject) => {
      const iframeWindow = this.iframe.contentWindow as HtmlCsWindow | null;
      if (iframeWindow?.HTMLCS === undefined) {
        reject(new Error('HTML CodeSniffer not available in iframe'));
        return;
      }

      iframeWindow.HTMLCS.process(HtmlCsEngine.STANDARD, iframeWindow.document, () => {
        const messages = (iframeWindow as HtmlCsWindow).HTMLCS?.getMessages() ?? [];
        resolve(messages);
      });
    });
  }

  private normalizeMessages(messages: HtmlCsMessage[], type: number): AccessibilityIssue[] {
    return messages
      .filter((msg) => msg.type === type)
      .map((msg): AccessibilityIssue => ({
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
        ] satisfies IssueNode[],
      }));
  }
}
