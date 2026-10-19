import type { ContentFactsIndex } from '../../src/ContentFacts';
import { AxeEngine } from '../../src/engines/AxeEngine';

interface AxeWindow extends Window {
  axe?: { run: jest.Mock; configure?: jest.Mock };
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

describe('AxeEngine locale', () => {
  const originalFetch = global.fetch;
  const emptyResults = { violations: [], incomplete: [], passes: [], url: '' };

  function setupIframeWithConfigurableAxe(axeRun: jest.Mock, axeConfigure: jest.Mock): HTMLIFrameElement {
    const iframe = setupIframeWithAxe('<body></body>', axeRun);
    (iframe.contentWindow as AxeWindow).axe = { run: axeRun, configure: axeConfigure };
    return iframe;
  }

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('configures the locale before running the scan', async () => {
    const locale = { lang: 'de', rules: {} };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(locale) });
    const axeRun = jest.fn().mockResolvedValue(emptyResults);
    const axeConfigure = jest.fn();
    const iframe = setupIframeWithConfigurableAxe(axeRun, axeConfigure);

    await new AxeEngine(iframe, '/axe.min.js', makeIndex(), '/axe-locales/de.json').run();

    expect(global.fetch).toHaveBeenCalledWith('/axe-locales/de.json');
    expect(axeConfigure).toHaveBeenCalledWith({ locale });
    expect(axeConfigure.mock.invocationCallOrder[0]).toBeLessThan(axeRun.mock.invocationCallOrder[0] ?? 0);
  });

  it('does not load a locale when none is given', async () => {
    global.fetch = jest.fn();
    const axeConfigure = jest.fn();
    const iframe = setupIframeWithConfigurableAxe(jest.fn().mockResolvedValue(emptyResults), axeConfigure);

    await new AxeEngine(iframe, '/axe.min.js', makeIndex()).run();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(axeConfigure).not.toHaveBeenCalled();
  });

  it('still scans with the English messages when the locale cannot be loaded', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const axeRun = jest.fn().mockResolvedValue(emptyResults);
    const axeConfigure = jest.fn();
    const iframe = setupIframeWithConfigurableAxe(axeRun, axeConfigure);

    await expect(new AxeEngine(iframe, '/axe.min.js', makeIndex(), '/axe-locales/de.json').run()).resolves.toEqual(
      emptyResults,
    );
    expect(axeConfigure).not.toHaveBeenCalled();
    expect(axeRun).toHaveBeenCalled();
  });

  it('still scans with the English messages when axe-core rejects the locale', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ checks: { unknown: {} } }) });
    const axeRun = jest.fn().mockResolvedValue(emptyResults);
    const axeConfigure = jest.fn(() => {
      throw new Error('Locale provided for unknown check: "unknown"');
    });
    const iframe = setupIframeWithConfigurableAxe(axeRun, axeConfigure);

    await expect(new AxeEngine(iframe, '/axe.min.js', makeIndex(), '/axe-locales/de.json').run()).resolves.toEqual(
      emptyResults,
    );
    expect(axeRun).toHaveBeenCalled();
  });
});
