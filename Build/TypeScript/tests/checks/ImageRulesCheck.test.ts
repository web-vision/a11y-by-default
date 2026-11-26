import {
  IMAGE_RULES,
  ImageRulesCheck,
  MIN_ALT_LENGTH,
  REDUNDANT_IMG_TITLE_RULE_ID,
} from '../../src/checks/ImageRulesCheck';
import type { ContentFactsIndex } from '../../src/ContentFacts';
import { ViolationClassifier } from '../../src/ViolationClassifier';

const resolveLabel = (key: string): string => `label:${key}`;

type ImageEntry = ContentFactsIndex['images'][number];

function makeIndex(images: ContentFactsIndex['images'] = []): ContentFactsIndex {
  return { headings: [], links: [], images, tables: [] };
}

function makeFact(overrides: Partial<ImageEntry> = {}): ImageEntry {
  return {
    hasAltData: true,
    alternative: 'A descriptive text',
    title: '',
    fileName: 'a.jpg',
    matchers: ['a.jpg'],
    contentElementUid: 7,
    ...overrides,
  };
}

function makeDocument(body: string): Document {
  return new DOMParser().parseFromString(`<html><body>${body}</body></html>`, 'text/html');
}

function run(body: string, index: ContentFactsIndex = makeIndex()): ReturnType<ImageRulesCheck['run']> {
  return new ImageRulesCheck(resolveLabel).run(makeDocument(body), index);
}

function ids(body: string, index: ContentFactsIndex = makeIndex()): string[] {
  return run(body, index).map((issue) => issue.id);
}

const RULE_IDS = [
  'a11y-redundant-img-title',
  'a11y-img-alt-too-short',
  'a11y-img-alt-redundant-prefix',
  'a11y-img-alt-filename',
];

describe('IMAGE_RULES', () => {
  it('lists the four rules with their impact', () => {
    expect(IMAGE_RULES.map((rule) => [rule.id, rule.impact])).toEqual([
      ['a11y-redundant-img-title', 'minor'],
      ['a11y-img-alt-too-short', 'minor'],
      ['a11y-img-alt-redundant-prefix', 'minor'],
      ['a11y-img-alt-filename', 'serious'],
    ]);
    expect(REDUNDANT_IMG_TITLE_RULE_ID).toBe('a11y-redundant-img-title');
    expect(MIN_ALT_LENGTH).toBe(5);
  });
});

describe('ImageRulesCheck issue shape', () => {
  it('emits the documented shape for a violated rule', () => {
    const issues = run('<img src="a.jpg" alt="A cat" title="A cat">');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: 'a11y-redundant-img-title',
      impact: 'minor',
      tags: ['best-practice'],
      helpUrl: 'https://www.w3.org/WAI/tutorials/images/',
      help: 'label:rule.a11y-redundant-img-title.help',
      description: 'label:rule.a11y-redundant-img-title.description',
    });
    expect(issues[0].nodes).toHaveLength(1);
    expect(issues[0].nodes[0].html).toContain('<img');
    expect(issues[0].nodes[0].target).toHaveLength(1);
  });

  it('uses the rule id for the labels and the impact of every rule', () => {
    const issues = run('<img src="a.jpg" alt="x.jpg">');
    const filename = issues.find((issue) => issue.id === 'a11y-img-alt-filename');
    expect(filename?.impact).toBe('serious');
    expect(filename?.help).toBe('label:rule.a11y-img-alt-filename.help');
    expect(filename?.description).toBe('label:rule.a11y-img-alt-filename.description');
  });

  it('produces a target selector that finds the offending image', () => {
    const doc = makeDocument('<p><img src="x.jpg" alt="A descriptive text"></p><img src="a.jpg" alt="A" title="A">');
    const issues = new ImageRulesCheck(resolveLabel).run(doc, makeIndex());
    const found = doc.querySelectorAll(issues[0].nodes[0].target[0]);
    expect(found).toHaveLength(1);
    expect(found[0].getAttribute('src')).toBe('a.jpg');
  });

  it('skips images without alt or with an empty alt', () => {
    expect(run('<img src="a.jpg">')).toEqual([]);
    expect(run('<img src="a.jpg" alt="" title="">')).toEqual([]);
    expect(run('<img src="a.jpg" alt="   " title="  ">')).toEqual([]);
  });

  it('emits no issue for a normal descriptive alt', () => {
    expect(run('<img src="/fileadmin/team.jpg" alt="The team at the summer party">')).toEqual([]);
  });

  it('emits one issue per image per violated rule', () => {
    const issues = run('<img src="one.jpg" alt="Foto" title="Foto"><img src="two.jpg" alt="B" title="B">');
    expect(issues.map((issue) => issue.id)).toEqual([
      'a11y-redundant-img-title',
      'a11y-img-alt-too-short',
      'a11y-img-alt-redundant-prefix',
      'a11y-redundant-img-title',
      'a11y-img-alt-too-short',
    ]);
  });
});

describe('a11y-redundant-img-title', () => {
  it('reports a title equal to the alt, ignoring case and whitespace', () => {
    expect(ids('<img src="a.jpg" alt="  A   Cat on sofa " title="a cat on sofa">')).toEqual([
      'a11y-redundant-img-title',
    ]);
  });

  it('ignores a differing title, a missing title', () => {
    expect(ids('<img src="a.jpg" alt="A cat on the sofa" title="Photo by Joe">')).toEqual([]);
    expect(ids('<img src="a.jpg" alt="A cat on the sofa">')).toEqual([]);
  });
});

describe('a11y-img-alt-too-short', () => {
  it.each([['A'], ['Logo'], ['  ab  '], ['ÄÖÜ😀']])('reports "%s"', (alt) => {
    expect(ids(`<img src="one.jpg" alt="${alt}">`)).toEqual(['a11y-img-alt-too-short']);
  });

  it('accepts exactly the minimum length, counted in code points', () => {
    expect(ids('<img src="a.jpg" alt="Hunde">')).toEqual([]);
    expect(ids('<img src="a.jpg" alt="😀😀😀😀😀">')).toEqual([]);
  });
});

describe('a11y-img-alt-redundant-prefix', () => {
  it.each([
    ['Foto von einem Hund'],
    ['Image: dog'],
    ['Bild'],
    ['a photo of a dog'],
    ['Das Bild zeigt einen Hund'],
    ['The picture shows a dog'],
    ['Screenshot of the dashboard'],
  ])('reports "%s"', (alt) => {
    expect(ids(`<img src="a.jpg" alt="${alt}">`)).toContain('a11y-img-alt-redundant-prefix');
  });

  it.each([['Bildschirm mit Code'], ['Fotografin Anna'], ['Picture frame on a wall'], ['Dog on a meadow']])(
    'accepts "%s"',
    (alt) => {
      expect(ids(`<img src="a.jpg" alt="${alt}">`)).not.toContain('a11y-img-alt-redundant-prefix');
    },
  );
});

describe('a11y-img-alt-filename', () => {
  it('reports a camera-generated name', () => {
    expect(ids('<img src="/x/y.jpg" alt="IMG_1234">')).toEqual(['a11y-img-alt-filename']);
  });

  it('reports an alt ending with an image extension', () => {
    expect(ids('<img src="/x/y.jpg" alt="dsc01234.jpg">')).toContain('a11y-img-alt-filename');
    expect(ids('<img src="/x/y.jpg" alt="some thing.PNG">')).toEqual(['a11y-img-alt-filename']);
  });

  it('reports an alt equal to the file name from the src, with and without extension', () => {
    expect(ids('<img src="/fileadmin/team-photo.jpg?v=1#x" alt="team-photo.jpg">')).toContain('a11y-img-alt-filename');
    expect(ids('<img src="/fileadmin/team-photo.jpg" alt="Team-Photo">')).toEqual(['a11y-img-alt-filename']);
  });

  it('decodes the file name of the src', () => {
    expect(ids('<img src="/fileadmin/mein%20hund" alt="mein hund">')).toEqual(['a11y-img-alt-filename']);
    expect(ids('<img src="/fileadmin/%E0%A4%A.jpg" alt="A descriptive text">')).toEqual([]);
  });

  it('compares against the stored file name when the src is a processed csm_ name', () => {
    const index = makeIndex([makeFact({ fileName: 'Team-Photo.jpg', matchers: ['csm_Team-Photo_abc123.jpg'] })]);
    const body = '<img src="/_processed_/0/csm_Team-Photo_abc123.jpg" alt="team-photo.jpg">';
    expect(ids(body, index)).toContain('a11y-img-alt-filename');
    const withoutExt = '<img src="/_processed_/0/csm_Team-Photo_abc123.jpg" alt="team-photo">';
    expect(ids(withoutExt, index)).toEqual(['a11y-img-alt-filename']);
  });

  it('accepts a descriptive alt', () => {
    expect(ids('<img src="/fileadmin/team-photo.jpg" alt="Our team at the summer party">')).toEqual([]);
  });
});

describe('classification', () => {
  const classifier = new ViolationClassifier(
    Object.fromEntries(
      RULE_IDS.map((id) => [id, { responsibility: 'editor', hint: 'Editor hint', developerHint: 'Developer hint' }]),
    ),
  );

  // [rule id, rendered alt (violating), title, stored values that violate, stored values that are fine]
  const cases: Array<[string, string, string, Partial<ImageEntry>, Partial<ImageEntry>]> = [
    [
      'a11y-redundant-img-title',
      'A cat on the sofa',
      'A cat on the sofa',
      { alternative: 'A cat on the sofa', title: 'a cat on the sofa' },
      { alternative: 'A cat on the sofa', title: 'Photo by Joe' },
    ],
    ['a11y-img-alt-too-short', 'Cat', '', { alternative: 'Cat' }, { alternative: 'A cat on the sofa' }],
    [
      'a11y-img-alt-redundant-prefix',
      'Foto von einer Katze',
      '',
      { alternative: 'Foto von einer Katze' },
      { alternative: 'Eine Katze' },
    ],
    ['a11y-img-alt-filename', 'IMG_1234', '', { alternative: 'IMG_1234' }, { alternative: 'A cat on the sofa' }],
  ];

  it.each(cases)('%s: violating stored values go to the editor', (ruleId, alt, title, bad) => {
    const index = makeIndex([makeFact(bad)]);
    const issue = run(`<img src="/a.jpg" alt="${alt}" title="${title}">`, index).find((i) => i.id === ruleId);
    expect(issue?.nodes[0].contentElementUid).toBe(7);
    expect(issue?.nodes[0].dataAvailable).toBe(false);
    expect(classifier.classify(issue!)).toEqual({
      responsibility: 'editor',
      hint: 'Editor hint',
      contentElementUid: 7,
    });
  });

  it.each(cases)('%s: fine stored values with violating output go to the developer', (ruleId, alt, title, _b, good) => {
    const index = makeIndex([makeFact(good)]);
    const issue = run(`<img src="/a.jpg" alt="${alt}" title="${title}">`, index).find((i) => i.id === ruleId);
    expect(issue?.nodes[0].dataAvailable).toBe(true);
    expect(classifier.classify(issue!).responsibility).toBe('developer');
  });

  it.each(cases)(
    '%s: an alt text invented by the template for an empty stored one goes to the developer',
    (ruleId, alt, title) => {
      const index = makeIndex([makeFact({ alternative: '', title: '' })]);
      const issue = run(`<img src="/a.jpg" alt="${alt}" title="${title}">`, index).find((i) => i.id === ruleId);
      expect(issue?.nodes[0].dataAvailable).toBe(true);
      expect(classifier.classify(issue!).responsibility).toBe('developer');
    },
  );

  it.each(cases)('%s: an unmatched image goes to the developer', (ruleId, alt, title) => {
    const issue = run(`<img src="/logo.svg" alt="${alt}" title="${title}">`).find((i) => i.id === ruleId);
    expect(issue?.nodes[0].contentElementUid).toBeUndefined();
    expect(issue?.nodes[0].dataAvailable).toBeUndefined();
    expect(classifier.classify(issue!).responsibility).toBe('developer');
  });
});
