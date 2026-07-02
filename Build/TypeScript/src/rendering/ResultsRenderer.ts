import { IssueCardRenderer } from './IssueCardRenderer';
import { IssueSectionRenderer } from './IssueSectionRenderer';
import { Typo3Backend } from '../backend/Typo3Backend';
import type { FilterController } from '../filtering/FilterController';
import type { ViolationClassifier } from '../ViolationClassifier';
import type { ScanResult } from '../types';

export class ResultsRenderer {
  private readonly sectionRenderer: IssueSectionRenderer;

  constructor(
    classifier: ViolationClassifier,
    private readonly filterController: FilterController,
  ) {
    this.sectionRenderer = new IssueSectionRenderer(new IssueCardRenderer(classifier));
  }

  render(container: HTMLElement, result: ScanResult): void {
    const successCallout =
      result.violations.length === 0 && result.incomplete.length === 0
        ? `<div class="callout callout-success mb-4"><div class="callout-body"><p>${Typo3Backend.getLabel('module.results.empty')}</p></div></div>`
        : '';

    const incompleteInfoCallout = `<div class="callout callout-info mb-3"><div class="callout-body"><p>${Typo3Backend.getLabel('module.results.incomplete.info')}</p></div></div>`;

    container.innerHTML = `
        ${successCallout}
        ${this.sectionRenderer.render(result.violations, 'a11y-violations-heading', Typo3Backend.getLabel('module.results.violations'), 'text-bg-danger', 'a11y-violations-count')}
        <hr class="my-4">
        ${this.sectionRenderer.render(result.incomplete, 'a11y-incomplete-heading', Typo3Backend.getLabel('module.results.incomplete'), 'text-bg-warning', 'a11y-incomplete-count', incompleteInfoCallout)}`;

    this.filterController.updateFilterCounts(container);
    this.filterController.applyFilters(container);
  }
}
