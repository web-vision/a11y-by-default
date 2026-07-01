import type { ContentFactsIndex } from '../../src/ContentFacts';
import { HtmlCsEngine } from '../../src/engines/HtmlCsEngine';

interface HtmlCsWindow extends Window {
  HTMLCS?: {
    process: jest.Mock;
    getMessages: jest.Mock;
    ERROR: number;
    WARNING: number;
    NOTICE: number;
  };
}

function setupIframeWithHtmlCs(bodyHtml: string, getMessages: jest.Mock): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);

  const iframeDocument = iframe.contentDocument!;
  iframeDocument.body.innerHTML = bodyHtml;
  (iframe.contentWindow as HtmlCsWindow).HTMLCS = {
    process: jest.fn((_standard: string, _doc: Document, callback: () => void) => callback()),
    getMessages,
    ERROR: 1,
    WARNING: 2,
    NOTICE: 3,
  };

  jest.spyOn(iframeDocument.head, 'appendChild').mockImplementation((node) => {
    queueMicrotask(() => (node as HTMLScriptElement).onload?.(new Event('load')));
    return node;
  });

  return iframe;
}

function makeIndex(overrides: Partial<ContentFactsIndex> = {}): ContentFactsIndex {
  return { headings: [], links: [], images: [], tables: [], ...overrides };
}

afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('HtmlCsEngine', () => {
  it('attaches a resolved contentElementUid using the message element directly', async () => {
    const iframe = setupIframeWithHtmlCs('<h3 class="headline">Heeeheeeeeheee</h3>', jest.fn());
    const element = iframe.contentDocument!.querySelector('h3')!;
    (iframe.contentWindow as HtmlCsWindow).HTMLCS!.getMessages = jest
      .fn()
      .mockReturnValue([{ code: 'heading-order', type: 1, msg: 'Heading order invalid', element }]);

    const index = makeIndex({ headings: [{ text: 'Heeeheeeeeheee', contentElementUid: 52 }] });
    const engine = new HtmlCsEngine(iframe, '/HTMLCS.min.js', index);
    const result = await engine.run();

    expect(result.violations[0]?.nodes[0]?.contentElementUid).toBe(52);
  });

  it('leaves contentElementUid unset when the element does not correlate with known content', async () => {
    const iframe = setupIframeWithHtmlCs('<a href="/" class="header__logo"></a>', jest.fn());
    const element = iframe.contentDocument!.querySelector('a')!;
    (iframe.contentWindow as HtmlCsWindow).HTMLCS!.getMessages = jest
      .fn()
      .mockReturnValue([{ code: 'link-name', type: 1, msg: 'Links must have discernible text', element }]);

    const engine = new HtmlCsEngine(iframe, '/HTMLCS.min.js', makeIndex());
    const result = await engine.run();

    expect(result.violations[0]?.nodes[0]?.contentElementUid).toBeUndefined();
  });

  it('splits messages into violations and incomplete by type', async () => {
    const iframe = setupIframeWithHtmlCs('<div></div>', jest.fn());
    const element = iframe.contentDocument!.querySelector('div')!;
    (iframe.contentWindow as HtmlCsWindow).HTMLCS!.getMessages = jest.fn().mockReturnValue([
      { code: 'rule-a', type: 1, msg: 'Error message', element },
      { code: 'rule-b', type: 2, msg: 'Warning message', element },
    ]);

    const engine = new HtmlCsEngine(iframe, '/HTMLCS.min.js', makeIndex());
    const result = await engine.run();

    expect(result.violations).toHaveLength(1);
    expect(result.incomplete).toHaveLength(1);
  });
});
