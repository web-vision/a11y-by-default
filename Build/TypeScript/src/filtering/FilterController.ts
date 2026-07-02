export class FilterController {
  bindSeverityToggles(resultsContainer: HTMLElement): void {
    document.querySelectorAll<HTMLInputElement>('.a11y-filter-severity').forEach((filterInput) => {
      this.syncToggleActiveState(filterInput);
      filterInput.addEventListener('change', () => {
        this.syncToggleActiveState(filterInput);
        this.applyFilters(resultsContainer);
      });
    });
  }

  // The severity toggle is a `.btn-check` input with a `.btn` label, TYPO3's own
  // pattern for button-styled options (see core's clipboard/localization panels).
  // Its "on" look is the label's real severity color class; "off" (including
  // disabled — a severity with zero findings in the active view) falls back to
  // the neutral `btn-default`, so a disabled button never looks clickable.
  syncToggleActiveState(input: HTMLInputElement): void {
    const label = document.querySelector<HTMLElement>(`label[for="${input.id}"]`);
    const btnClass = label?.dataset['btnClass'];
    if (label === null || label === undefined || btnClass === undefined) {
      return;
    }

    const isActive = input.checked && !input.disabled;
    label.classList.toggle(btnClass, isActive);
    label.classList.toggle('btn-default', !isActive);
  }

  // Severity counts/toggles are scoped to the active view tab: editors and
  // developers each see counts for only the findings assigned to them. The view
  // tab counts themselves stay totals across both, so each tab shows how many
  // findings it holds overall.
  updateFilterCounts(container: HTMLElement): void {
    const activeView = this.getActiveResponsibilityView();
    const severityCounts: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    const viewCounts: Record<'editor' | 'developer', number> = { editor: 0, developer: 0 };

    container.querySelectorAll<HTMLElement>('[data-impact]').forEach((card) => {
      const impact = card.dataset['impact'] ?? '';
      const responsibility = card.dataset['responsibility'] === 'editor' ? 'editor' : 'developer';
      viewCounts[responsibility] += 1;

      if (responsibility === activeView && impact in severityCounts) {
        severityCounts[impact] += 1;
      }
    });

    Object.entries(severityCounts).forEach(([impact, count]) => {
      const countEl = document.querySelector(`[data-severity-count="${impact}"]`);
      if (countEl !== null) {
        countEl.textContent = String(count);
      }

      const checkbox = document.getElementById(`a11y-filter-severity-${impact}`) as HTMLInputElement | null;
      if (checkbox !== null) {
        checkbox.disabled = count === 0;
        this.syncToggleActiveState(checkbox);
      }
    });

    (Object.keys(viewCounts) as Array<'editor' | 'developer'>).forEach((view) => {
      const countEl = document.querySelector(`[data-view-count="${view}"]`);
      if (countEl !== null) {
        countEl.textContent = String(viewCounts[view]);
      }
    });
  }

  applyFilters(container: HTMLElement): void {
    const activeSeverities = this.getActiveSeverityFilters();
    const activeView = this.getActiveResponsibilityView();

    container.querySelectorAll<HTMLElement>('[data-severity-group]').forEach((group) => {
      const severityActive = activeSeverities.has(group.dataset['severityGroup'] ?? '');
      let visibleCount = 0;

      group.querySelectorAll<HTMLElement>('[data-impact]').forEach((card) => {
        const matchesView =
          activeView === 'developer'
            ? card.dataset['responsibility'] !== 'editor'
            : card.dataset['responsibility'] === 'editor';
        const visible = severityActive && matchesView;
        card.classList.toggle('d-none', !visible);
        if (visible) {
          visibleCount += 1;
        }
      });

      group.classList.toggle('d-none', visibleCount === 0);
      const countBadge = group.querySelector('[data-severity-group-count]');
      if (countBadge !== null) {
        countBadge.textContent = String(visibleCount);
      }
    });

    this.updateResultCounts(container);
  }

  private getActiveResponsibilityView(): 'editor' | 'developer' {
    const activeTab = document.querySelector<HTMLElement>('[role="tab"][data-view][aria-selected="true"]');
    return activeTab?.dataset['view'] === 'developer' ? 'developer' : 'editor';
  }

  private getActiveSeverityFilters(): Set<string> {
    const checkboxes = document.querySelectorAll<HTMLInputElement>('.a11y-filter-severity');
    return new Set(
      Array.from(checkboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value),
    );
  }

  private updateResultCounts(container: HTMLElement): void {
    const countVisible = (headingId: string): number =>
      container.querySelectorAll(`[aria-labelledby="${headingId}"] [data-impact]:not(.d-none)`).length;

    const violationsBadge = document.getElementById('a11y-violations-count');
    if (violationsBadge !== null) {
      violationsBadge.textContent = String(countVisible('a11y-violations-heading'));
    }

    const incompleteBadge = document.getElementById('a11y-incomplete-count');
    if (incompleteBadge !== null) {
      incompleteBadge.textContent = String(countVisible('a11y-incomplete-heading'));
    }
  }
}
