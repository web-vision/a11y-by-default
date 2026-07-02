import { IssueCardRenderer } from '../../src/rendering/IssueCardRenderer';
import { ViolationClassifier } from '../../src/ViolationClassifier';
import type { AccessibilityIssue } from '../../src/types';

function makeIssue(overrides: Partial<AccessibilityIssue> = {}): AccessibilityIssue {
  return {
    id: 'image-alt',
    impact: 'serious',
    help: 'Images must have alternate text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.6/image-alt',
    description: 'Ensures img elements have alternate text',
    tags: ['wcag2a'],
    nodes: [{ html: '<img src="photo.jpg">', target: ['#main img'] }],
    ...overrides,
  };
}

function mockTYPO3Lang(): void {
  (window as unknown as Record<string, unknown>).TYPO3 = {
    lang: {
      'module.results.violations': 'Violations',
    },
    settings: {
      FormEngine: {
        moduleUrl: '/typo3/record/edit?token=abc123token',
      },
    },
  };
}

describe('IssueCardRenderer', () => {
  beforeEach(() => {
    mockTYPO3Lang();
  });

  it('uses the task description as the collapsible header', () => {
    const renderer = new IssueCardRenderer(new ViolationClassifier({}));
    const html = renderer.render(makeIssue(), 'panel-1');
    expect(html).toContain('panel-title">Images must have alternate text<');
  });

  it('does not render editor/developer responsibility badges — that distinction lives in the view tabs now', () => {
    const renderer = new IssueCardRenderer(
      new ViolationClassifier({ 'image-alt': { responsibility: 'editor', hint: 'Add alt text.' } }),
    );
    const html = renderer.render(makeIssue(), 'panel-1');
    expect(html).not.toContain('text-bg-primary');
    expect(html).not.toContain('text-bg-secondary');
  });

  it('wires the collapse target to the given panel id', () => {
    const renderer = new IssueCardRenderer(new ViolationClassifier({}));
    const html = renderer.render(makeIssue(), 'a11y-violations-group-critical-issue-0');
    expect(html).toContain('data-bs-target="#a11y-violations-group-critical-issue-0"');
    expect(html).toContain('id="a11y-violations-group-critical-issue-0"');
    expect(html).toContain('aria-controls="a11y-violations-group-critical-issue-0"');
  });

  it('starts collapsed', () => {
    const renderer = new IssueCardRenderer(new ViolationClassifier({}));
    const html = renderer.render(makeIssue(), 'panel-1');
    expect(html).toContain('panel-button collapsed');
    expect(html).toContain('aria-expanded="false"');
  });

  it('shows the issue description in the panel body', () => {
    const renderer = new IssueCardRenderer(new ViolationClassifier({}));
    const html = renderer.render(makeIssue(), 'panel-1');
    expect(html).toContain('Ensures img elements have alternate text');
  });

  it('renders failing HTML nodes in a read-only code viewer', () => {
    const renderer = new IssueCardRenderer(new ViolationClassifier({}));
    const html = renderer.render(makeIssue(), 'panel-1');
    expect(html).toContain('<a11y-code-viewer');
    expect(html).toContain('&lt;img src=&quot;photo.jpg&quot;&gt;');
  });

  it('includes a content element edit link when the classifier identifies one', () => {
    const renderer = new IssueCardRenderer(
      new ViolationClassifier({ 'image-alt': { responsibility: 'editor', hint: 'Add alt text.' } }),
    );
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderer.render(issueWithCe, 'panel-1');
    expect(html).toContain('edit[tt_content][5]');
  });

  it('builds the edit link from the pre-tokenized FormEngine module URL, not a raw guess', () => {
    const renderer = new IssueCardRenderer(
      new ViolationClassifier({ 'image-alt': { responsibility: 'editor', hint: 'Add alt text.' } }),
    );
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderer.render(issueWithCe, 'panel-1');
    expect(html).toContain('/typo3/record/edit?token=abc123token&amp;edit[tt_content][5]=edit');
    expect(html).toContain('module=web_a11y_by_default');
    expect(html).toContain('returnUrl=');
  });

  it('omits the content element link when no valid FormEngine module URL is available', () => {
    const typo3 = (window as unknown as Record<string, unknown>)['TYPO3'] as { lang: Record<string, string> };
    (window as unknown as Record<string, unknown>).TYPO3 = { lang: typo3.lang, settings: {} };
    const renderer = new IssueCardRenderer(
      new ViolationClassifier({ 'image-alt': { responsibility: 'editor', hint: 'Add alt text.' } }),
    );
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderer.render(issueWithCe, 'panel-1');
    expect(html).not.toContain('edit[tt_content]');
  });

  it('uses the side-panel edit trigger when a contextual edit module URL is available (TYPO3 v14+)', () => {
    const typo3 = (window as unknown as Record<string, unknown>)['TYPO3'] as {
      lang: Record<string, string>;
      settings: { FormEngine: { moduleUrl: string } };
    };
    (window as unknown as Record<string, unknown>).TYPO3 = {
      lang: typo3.lang,
      settings: {
        ...typo3.settings,
        a11yByDefault: { contextualEditModuleUrl: '/typo3/record/edit/contextual?token=sidepaneltoken' },
      },
    };
    const renderer = new IssueCardRenderer(
      new ViolationClassifier({ 'image-alt': { responsibility: 'editor', hint: 'Add alt text.' } }),
    );
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderer.render(issueWithCe, 'panel-1');
    expect(html).toContain('<typo3-backend-contextual-record-edit-trigger');
    expect(html).toContain('url="/typo3/record/edit/contextual?token=sidepaneltoken&amp;edit[tt_content][5]=edit');
    expect(html).toContain('edit-url="/typo3/record/edit?token=abc123token&amp;edit[tt_content][5]=edit');
    expect(html).toContain('</typo3-backend-contextual-record-edit-trigger>');
  });

  it('falls back to the classic anchor when no contextual edit module URL is set (TYPO3 v13)', () => {
    const renderer = new IssueCardRenderer(
      new ViolationClassifier({ 'image-alt': { responsibility: 'editor', hint: 'Add alt text.' } }),
    );
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderer.render(issueWithCe, 'panel-1');
    expect(html).not.toContain('<typo3-backend-contextual-record-edit-trigger');
    expect(html).toContain('<a href="/typo3/record/edit?token=abc123token&amp;edit[tt_content][5]=edit');
  });

  it('falls back to the classic anchor when the contextual edit module URL is explicitly null (TYPO3 v13)', () => {
    // A11yController emits `contextualEditModuleUrl: null` via json_encode on TYPO3 v13,
    // which reaches the browser as JS `null`, not `undefined` — must be treated the same.
    const typo3 = (window as unknown as Record<string, unknown>)['TYPO3'] as {
      lang: Record<string, string>;
      settings: { FormEngine: { moduleUrl: string } };
    };
    (window as unknown as Record<string, unknown>).TYPO3 = {
      lang: typo3.lang,
      settings: {
        ...typo3.settings,
        a11yByDefault: { contextualEditModuleUrl: null },
      },
    };
    const renderer = new IssueCardRenderer(
      new ViolationClassifier({ 'image-alt': { responsibility: 'editor', hint: 'Add alt text.' } }),
    );
    const issueWithCe = makeIssue({
      nodes: [{ html: '<img>', target: ['#c5 img'], contentElementUid: 5 }],
    });
    const html = renderer.render(issueWithCe, 'panel-1');
    expect(html).not.toContain('<typo3-backend-contextual-record-edit-trigger');
    expect(html).toContain('<a href="/typo3/record/edit?token=abc123token&amp;edit[tt_content][5]=edit');
  });

  it('omits the content element link for developer responsibility', () => {
    const renderer = new IssueCardRenderer(
      new ViolationClassifier({ 'image-alt': { responsibility: 'developer', hint: 'Fix in template.' } }),
    );
    const html = renderer.render(makeIssue(), 'panel-1');
    expect(html).not.toContain('edit[tt_content]');
  });

  it('includes data attributes for impact and responsibility to support filtering', () => {
    const renderer = new IssueCardRenderer(
      new ViolationClassifier({ 'image-alt': { responsibility: 'editor', hint: 'Add alt text.' } }),
    );
    const issue = makeIssue({
      impact: 'critical',
      nodes: [{ html: '<img src="photo.jpg">', target: ['#main img'], contentElementUid: 5 }],
    });
    const html = renderer.render(issue, 'panel-1');
    expect(html).toContain('data-impact="critical"');
    expect(html).toContain('data-responsibility="editor"');
  });
});
