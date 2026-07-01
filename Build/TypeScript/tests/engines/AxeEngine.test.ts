import type { ContentFactsIndex } from '../../src/ContentFacts';
import { AxeEngine } from '../../src/engines/AxeEngine';

interface AxeWindow extends Window {
  axe?: { run: jest.Mock };
}

function setupIframeWithAxe(bodyHtml: string, axeRun: jest.Mock): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);

  const iframeDocument = iframe.contentDocument!;
  iframeDocument.body.innerHTML = bodyHtml;
  (iframe.contentWindow as AxeWindow).axe = { run: axeRun };

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

describe('AxeEngine', () => {
  it('attaches a resolved contentElementUid to a node whose element correlates with known content', async () => {
    const axeRun = jest.fn().mockResolvedValue({
      violations: [
        {
          id: 'heading-order',
          impact: 'moderate',
          description: 'Ensure the order of headings is semantically correct',
          help: 'Heading levels should only increase by one',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.12/heading-order',
          tags: [],
          nodes: [{ html: '<h3 class="headline">Heeeheeeeeheee</h3>', target: ['h3'] }],
        },
      ],
      incomplete: [],
      passes: [],
      url: '',
    });
    const iframe = setupIframeWithAxe('<h1>Tset</h1><h3 class="headline">Heeeheeeeeheee</h3>', axeRun);
    const index = makeIndex({ headings: [{ text: 'Heeeheeeeeheee', contentElementUid: 52 }] });

    const engine = new AxeEngine(iframe, '/axe.min.js', index);
    const result = await engine.run();

    expect(result.violations[0]?.nodes[0]?.contentElementUid).toBe(52);
  });

  it('leaves contentElementUid unset when the element does not correlate with known content', async () => {
    const axeRun = jest.fn().mockResolvedValue({
      violations: [
        {
          id: 'link-name',
          impact: 'serious',
          description: 'Ensure links have discernible text',
          help: 'Links must have discernible text',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.12/link-name',
          tags: [],
          nodes: [{ html: '<a href="/" class="header__logo"></a>', target: ['.header__logo'] }],
        },
      ],
      incomplete: [],
      passes: [],
      url: '',
    });
    const iframe = setupIframeWithAxe('<a href="/" class="header__logo"></a>', axeRun);

    const engine = new AxeEngine(iframe, '/axe.min.js', makeIndex());
    const result = await engine.run();

    expect(result.violations[0]?.nodes[0]?.contentElementUid).toBeUndefined();
  });

  it('defaults to an empty content facts index when none is provided', async () => {
    const axeRun = jest.fn().mockResolvedValue({ violations: [], incomplete: [], passes: [], url: '' });
    const iframe = setupIframeWithAxe('<body></body>', axeRun);

    const engine = new AxeEngine(iframe, '/axe.min.js');
    await expect(engine.run()).resolves.toEqual({ violations: [], incomplete: [], passes: [], url: '' });
  });
});
