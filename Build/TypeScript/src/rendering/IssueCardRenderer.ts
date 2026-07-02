import { ContentElementEditLink } from './ContentElementEditLink';
import { Html } from './Html';
import { Typo3Backend } from '../backend/Typo3Backend';
import type { ViolationClassifier } from '../ViolationClassifier';
import type { AccessibilityIssue, Classification } from '../types';

// A per-task collapsible panel, TYPO3's own accordion pattern (see core's
// ContentElement/ElementInformation.html panel-heading/panel-collapse markup).
// Its header is just the task description — the editor/developer distinction
// is handled by the view tabs, not a per-row badge.
export class IssueCardRenderer {
  constructor(private readonly classifier: ViolationClassifier) {}

  render(issue: AccessibilityIssue, panelId: string): string {
    const classification: Classification = this.classifier.classify(issue);
    const contentElementLink =
      classification.contentElementUid !== undefined
        ? ContentElementEditLink.build(classification.contentElementUid)
        : '';

    const nodes = issue.nodes
      .map((node) => `<a11y-code-viewer class="mb-1">${Html.escape(node.html)}</a11y-code-viewer>`)
      .join('');

    return `<div class="panel panel-default mb-1" data-impact="${Html.escape(issue.impact)}" data-responsibility="${Html.escape(classification.responsibility)}">
        <div class="panel-heading" role="tab">
            <div class="panel-heading-row">
                <button class="panel-button collapsed" type="button" data-bs-toggle="collapse"
                        data-bs-target="#${panelId}" aria-controls="${panelId}" aria-expanded="false">
                    <span class="panel-title">${Html.escape(issue.help)}</span>
                    <span class="caret"></span>
                </button>
            </div>
        </div>
        <div id="${panelId}" class="panel-collapse collapse" role="tabpanel">
            <div class="panel-body">
                <p class="card-text">${Html.escape(issue.description)}</p>
                <p class="card-text text-body-secondary small">${Html.escape(classification.hint)}</p>
                <a href="${Html.escape(issue.helpUrl)}" target="_blank" rel="noopener noreferrer"
                   class="btn btn-sm btn-default mb-2 d-inline-block" title="${Html.escape(Typo3Backend.getLabel('module.results.violations'))}">
                    <span aria-hidden="true">?</span>
                    <span class="visually-hidden">${Html.escape(issue.help)}</span>
                </a>
                ${contentElementLink}
                ${nodes}
            </div>
        </div>
    </div>`;
  }
}
