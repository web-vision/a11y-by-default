import { RedundantImageTitleCheck, REDUNDANT_IMG_TITLE_RULE_ID } from '../../src/checks/RedundantImageTitleCheck';
import type { ContentFactsIndex } from '../../src/ContentFacts';
import { ViolationClassifier } from '../../src/ViolationClassifier';

const labels: Record<string, string> = {
  'rule.a11y-redundant-img-title.help': 'Help label',
  'rule.a11y-redundant-img-title.description': 'Description label',
};
const resolveLabel = (key: string): string => labels[key] ?? key;

function makeIndex(images: ContentFactsIndex['images'] = []): ContentFactsIndex {
  return { headings: [], links: [], images, tables: [] };
}

function makeDocument(body: string): Document {
  return new DOMParser().parseFromString(`<html><body>${body}</body></html>`, 'text/html');
}

function run(body: string, index: ContentFactsIndex = makeIndex()): ReturnType<RedundantImageTitleCheck['run']> {
  return new RedundantImageTitleCheck(resolveLabel).run(makeDocument(body), index);
}

describe('RedundantImageTitleCheck', () => {
  it('reports an image whose title equals its alt text', () => {
    const issues = run('<img src="a.jpg" alt="A cat" title="A cat">');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: 'a11y-redundant-img-title',
      impact: 'minor',
      tags: ['best-practice'],
      helpUrl: 'https://www.w3.org/WAI/tutorials/images/',
      help: 'Help label',
      description: 'Description label',
    });
    expect(REDUNDANT_IMG_TITLE_RULE_ID).toBe('a11y-redundant-img-title');
    expect(issues[0].nodes).toHaveLength(1);
    expect(issues[0].nodes[0].html).toContain('<img');
    expect(issues[0].nodes[0].target).toHaveLength(1);
  });

  it('produces a target selector that finds the offending image', () => {
    const doc = makeDocument('<p><img src="x.jpg" alt="x"></p><img src="a.jpg" alt="A" title="A">');
    const issues = new RedundantImageTitleCheck(resolveLabel).run(doc, makeIndex());
    const found = doc.querySelectorAll(issues[0].nodes[0].target[0]);
    expect(found).toHaveLength(1);
    expect(found[0].getAttribute('src')).toBe('a.jpg');
  });

  it('ignores case and whitespace differences', () => {
    expect(run('<img src="a.jpg" alt="  A   Cat " title="a cat">')).toHaveLength(1);
  });

  it('ignores images with differing alt and title', () => {
    expect(run('<img src="a.jpg" alt="A cat" title="Photo by Joe">')).toEqual([]);
  });

  it('ignores images with an empty alt text', () => {
    expect(run('<img src="a.jpg" alt="" title="">')).toEqual([]);
    expect(run('<img src="a.jpg" alt="  " title=" ">')).toEqual([]);
  });

  it('ignores images without a title or without alt', () => {
    expect(run('<img src="a.jpg" alt="A cat">')).toEqual([]);
    expect(run('<img src="a.jpg" title="A cat">')).toEqual([]);
  });

  it('emits one issue per offending image', () => {
    const issues = run('<img src="a.jpg" alt="A" title="A"><img src="b.jpg" alt="B" title="B">');
    expect(issues).toHaveLength(2);
  });

  it('adds the content element and dataAvailable false for a matched image with differing DB values', () => {
    const index = makeIndex([{ hasAltData: true, altEqualsTitle: false, matchers: ['a.jpg'], contentElementUid: 7 }]);
    const node = run('<img src="/fileadmin/a.jpg" alt="A" title="A">', index)[0].nodes[0];
    expect(node.contentElementUid).toBe(7);
    expect(node.dataAvailable).toBe(true);
  });

  it('marks a matched image with identical DB values as not data-available', () => {
    const index = makeIndex([{ hasAltData: true, altEqualsTitle: true, matchers: ['a.jpg'], contentElementUid: 7 }]);
    const node = run('<img src="/fileadmin/a.jpg" alt="A" title="A">', index)[0].nodes[0];
    expect(node.contentElementUid).toBe(7);
    expect(node.dataAvailable).toBe(false);
  });

  it('leaves an unmatched image without content element', () => {
    const node = run('<img src="/theme/logo.svg" alt="A" title="A">')[0].nodes[0];
    expect(node.contentElementUid).toBeUndefined();
    expect(node.dataAvailable).toBeUndefined();
  });

  describe('classification', () => {
    const classifier = new ViolationClassifier({
      'a11y-redundant-img-title': { responsibility: 'editor', hint: 'Editor hint', developerHint: 'Developer hint' },
    });

    it('sends identical DB values to the editor', () => {
      const index = makeIndex([{ hasAltData: true, altEqualsTitle: true, matchers: ['a.jpg'], contentElementUid: 7 }]);
      const issue = run('<img src="/a.jpg" alt="A" title="A">', index)[0];
      expect(classifier.classify(issue)).toEqual({
        responsibility: 'editor',
        hint: 'Editor hint',
        contentElementUid: 7,
      });
    });

    it('sends redundant output with fine DB values to the developer', () => {
      const index = makeIndex([{ hasAltData: true, altEqualsTitle: false, matchers: ['a.jpg'], contentElementUid: 7 }]);
      const issue = run('<img src="/a.jpg" alt="A" title="A">', index)[0];
      expect(classifier.classify(issue).responsibility).toBe('developer');
    });

    it('sends an unmatched image to the developer', () => {
      const issue = run('<img src="/logo.svg" alt="A" title="A">')[0];
      expect(classifier.classify(issue).responsibility).toBe('developer');
    });
  });
});
