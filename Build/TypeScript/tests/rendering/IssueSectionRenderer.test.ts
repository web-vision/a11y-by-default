import { IssueCardRenderer } from '../../src/rendering/IssueCardRenderer';
import { IssueSectionRenderer } from '../../src/rendering/IssueSectionRenderer';
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
      'module.results.empty': 'No accessibility issues found.',
      'module.filters.severity.critical': 'Critical',
      'module.filters.severity.serious': 'Serious',
      'module.filters.severity.moderate': 'Moderate',
      'module.filters.severity.minor': 'Minor',
    },
    settings: {
      FormEngine: {
        moduleUrl: '/typo3/record/edit?token=abc123token',
      },
    },
  };
}

function makeRenderer(classifier = new ViolationClassifier({})): IssueSectionRenderer {
  return new IssueSectionRenderer(new IssueCardRenderer(classifier));
}

describe('IssueSectionRenderer', () => {
  beforeEach(() => {
    mockTYPO3Lang();
  });

  it('shows an empty state message when there are no issues', () => {
    const html = makeRenderer().render([], 'violations-heading', 'Violations', 'text-bg-danger', 'violations-count');
    expect(html).toContain('No accessibility issues found.');
    expect(html).not.toContain('data-severity-group');
  });

  it('shows the heading with a badge containing the issue count', () => {
    const issues = [makeIssue(), makeIssue()];
    const html = makeRenderer().render(
      issues,
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
    );
    expect(html).toContain('Violations');
    expect(html).toContain('>2<');
  });

  it('gives the count badge the provided id so it can be updated after filtering', () => {
    const html = makeRenderer().render(
      [makeIssue()],
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
    );
    expect(html).toContain('id="violations-count"');
  });

  it('renders a task panel for each issue', () => {
    const html = makeRenderer().render(
      [makeIssue(), makeIssue({ id: 'color-contrast' })],
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
    );
    const taskCount = (html.match(/data-impact="/g) ?? []).length;
    expect(taskCount).toBe(2);
  });

  it('groups issues of the same severity under one collapsible group', () => {
    const issues = [
      makeIssue({ id: 'image-alt', impact: 'critical' }),
      makeIssue({ id: 'color-contrast', impact: 'critical' }),
    ];
    const html = makeRenderer().render(
      issues,
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
    );
    const groupCount = (html.match(/data-severity-group="critical"/g) ?? []).length;
    expect(groupCount).toBe(1);
    expect(html).toContain('data-severity-group-count>2<');
  });

  it('orders severity groups from critical down to minor, regardless of issue order', () => {
    const issues = [
      makeIssue({ id: 'minor-rule', impact: 'minor' }),
      makeIssue({ id: 'critical-rule', impact: 'critical' }),
      makeIssue({ id: 'moderate-rule', impact: 'moderate' }),
    ];
    const html = makeRenderer().render(
      issues,
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
    );
    const criticalIndex = html.indexOf('data-severity-group="critical"');
    const moderateIndex = html.indexOf('data-severity-group="moderate"');
    const minorIndex = html.indexOf('data-severity-group="minor"');
    expect(criticalIndex).toBeLessThan(moderateIndex);
    expect(moderateIndex).toBeLessThan(minorIndex);
  });

  it('omits a severity group entirely when no issue has that severity', () => {
    const html = makeRenderer().render(
      [makeIssue({ impact: 'critical' })],
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
    );
    expect(html).not.toContain('data-severity-group="minor"');
  });

  it("colors each severity group's header to match its filter button color", () => {
    const issues = [
      makeIssue({ id: 'critical-rule', impact: 'critical' }),
      makeIssue({ id: 'serious-rule', impact: 'serious' }),
      makeIssue({ id: 'moderate-rule', impact: 'moderate' }),
      makeIssue({ id: 'minor-rule', impact: 'minor' }),
    ];
    const html = makeRenderer().render(
      issues,
      'violations-heading',
      'Violations',
      'text-bg-danger',
      'violations-count',
    );
    expect(html).toContain('panel panel-danger mb-2" data-severity-group="critical"');
    expect(html).toContain('panel panel-warning mb-2" data-severity-group="serious"');
    expect(html).toContain('panel panel-info mb-2" data-severity-group="moderate"');
    expect(html).toContain('panel panel-secondary mb-2" data-severity-group="minor"');
  });
});
