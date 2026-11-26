jest.mock('../../src/engines/AxeEngine');
jest.mock('../../src/engines/HtmlCsEngine');

import { AxeEngine } from '../../src/engines/AxeEngine';
import { HtmlCsEngine } from '../../src/engines/HtmlCsEngine';
import { ScanRunner } from '../../src/scan/ScanRunner';
import type { ModuleSettings, ScanEngine } from '../../src/types';

const settings: ModuleSettings = {
  pageUid: 1,
  previewUri: '/preview',
  contentMetadata: [],
  contentFacts: {},
  axeJsUrl: '/axe.js',
  htmlcsJsUrl: '/htmlcs.js',
  classificationRules: {},
};

const engineViolation = {
  id: 'image-alt',
  impact: 'critical',
  description: 'd',
  help: 'h',
  helpUrl: 'u',
  tags: [],
  nodes: [],
};

function mockIframeLoad(): void {
  const origAppend = Node.prototype.appendChild;
  jest.spyOn(document.body, 'appendChild').mockImplementation(function (this: Node, node: Node): Node {
    const result = origAppend.call(this, node);
    if (node instanceof HTMLIFrameElement) {
      Object.defineProperty(node, 'contentDocument', {
        value: new DOMParser().parseFromString(
          '<html><body><img src="a.jpg" alt="Cat" title="cat"><img src="b.jpg" alt="IMG_1234"></body></html>',
          'text/html',
        ),
      });
      queueMicrotask(() => node.dispatchEvent(new Event('load')));
    }
    return result;
  });
}

describe('ScanRunner', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).TYPO3 = {
      lang: {
        'rule.a11y-redundant-img-title.help': 'Redundant title',
        'rule.a11y-img-alt-too-short.help': 'Too short',
      },
    };
    mockIframeLoad();
    const result = { violations: [engineViolation], incomplete: [], passes: [], url: '' };
    jest
      .mocked(AxeEngine)
      .mockImplementation(() => ({ run: jest.fn().mockResolvedValue(result) }) as unknown as AxeEngine);
    jest
      .mocked(HtmlCsEngine)
      .mockImplementation(() => ({ run: jest.fn().mockResolvedValue({ ...result }) }) as unknown as HtmlCsEngine);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.querySelectorAll('iframe').forEach((f) => f.remove());
  });

  it.each<ScanEngine>(['axe', 'htmlcs'])('appends the own image rule issues for the %s engine', async (engine) => {
    const result = await new ScanRunner().run(settings, engine);

    expect(result.violations.map((v) => v.id)).toEqual([
      'image-alt',
      'a11y-redundant-img-title',
      'a11y-img-alt-too-short',
      'a11y-img-alt-filename',
    ]);
    expect(result.violations[1]?.help).toBe('Redundant title');
    expect(result.violations[2]?.help).toBe('Too short');
    expect(document.querySelector('iframe')).toBeNull();
  });
});
