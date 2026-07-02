import { Html } from './Html';
import { IssueCardRenderer } from './IssueCardRenderer';
import { Typo3Backend } from '../backend/Typo3Backend';
import type { AccessibilityIssue } from '../types';

// The same color family as the severity filter buttons (btn-danger/warning/
// info/secondary), applied here via TYPO3's panel-* variants so the group
// header background/text/caret pick up the matching theme-aware colors.
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'danger',
  serious: 'warning',
  moderate: 'info',
  minor: 'secondary',
};

const SEVERITY_LEVELS = ['critical', 'serious', 'moderate', 'minor'] as const;

export class IssueSectionRenderer {
  constructor(private readonly cardRenderer: IssueCardRenderer) {}

  render(
    issues: AccessibilityIssue[],
    headingId: string,
    headingLabel: string,
    badgeClass: string,
    badgeId: string,
    headingInfoHtml = '',
  ): string {
    const sectionId = headingId.replace(/-heading$/, '');
    const groups =
      issues.length === 0
        ? `<p class="text-body-secondary">${Typo3Backend.getLabel('module.results.empty')}</p>`
        : SEVERITY_LEVELS.map((level) =>
            this.renderSeverityGroup(
              level,
              issues.filter((issue) => issue.impact === level),
              `${sectionId}-group-${level}`,
            ),
          ).join('');

    return `<section class="mb-4" aria-labelledby="${headingId}">
        <h2 id="${headingId}" class="h4 mb-3">
            ${headingLabel}
            <span class="badge ${badgeClass} ms-1" id="${badgeId}">${issues.length}</span>
        </h2>
        ${headingInfoHtml}
        ${groups}
    </section>`;
  }

  // A per-severity group of tasks, mirroring TYPO3's RecordList table collapse
  // (recordlist-heading + collapse target per content type). Expanded by
  // default so task titles are visible at a glance; each task's own detail
  // panel stays collapsed until clicked.
  private renderSeverityGroup(level: string, issues: AccessibilityIssue[], groupId: string): string {
    if (issues.length === 0) {
      return '';
    }

    const items = issues.map((issue, index) => this.cardRenderer.render(issue, `${groupId}-issue-${index}`)).join('');

    return `<div class="panel ${this.severityPanelClass(level)} mb-2" data-severity-group="${level}">
        <div class="panel-heading" role="tab">
            <div class="panel-heading-row">
                <button class="panel-button" type="button" data-bs-toggle="collapse"
                        data-bs-target="#${groupId}" aria-controls="${groupId}" aria-expanded="true">
                    <span class="panel-title">${Html.escape(Typo3Backend.getLabel(`module.filters.severity.${level}`))}</span>
                    <span class="badge text-bg-light ms-1" data-severity-group-count>${issues.length}</span>
                    <span class="caret"></span>
                </button>
            </div>
        </div>
        <div id="${groupId}" class="panel-collapse collapse show" role="tabpanel">
            <div class="panel-body p-0">
                ${items}
            </div>
        </div>
    </div>`;
  }

  private severityPanelClass(impact: string): string {
    return `panel-${SEVERITY_COLORS[impact] ?? 'secondary'}`;
  }
}
