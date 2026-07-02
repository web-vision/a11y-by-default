import type { FilterController } from './FilterController';

export class ViewTabController {
  constructor(private readonly filterController: FilterController) {}

  bind(resultsContainer: HTMLElement): void {
    const viewTabs = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"][data-view]'));

    const activateViewTab = (tab: HTMLElement): void => {
      viewTabs.forEach((otherTab) => {
        const isActive = otherTab === tab;
        otherTab.setAttribute('aria-selected', String(isActive));
        otherTab.setAttribute('tabindex', isActive ? '0' : '-1');
        otherTab.classList.toggle('active', isActive);
      });
      resultsContainer.setAttribute('aria-labelledby', tab.id);
      this.filterController.updateFilterCounts(resultsContainer);
      this.filterController.applyFilters(resultsContainer);
    };

    viewTabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateViewTab(tab));
      tab.addEventListener('keydown', (event) => {
        const key = (event as KeyboardEvent).key;
        let targetIndex: number | null = null;
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          targetIndex = (index + 1) % viewTabs.length;
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          targetIndex = (index - 1 + viewTabs.length) % viewTabs.length;
        } else if (key === 'Home') {
          targetIndex = 0;
        } else if (key === 'End') {
          targetIndex = viewTabs.length - 1;
        }

        if (targetIndex !== null) {
          event.preventDefault();
          const targetTab = viewTabs[targetIndex];
          if (targetTab !== undefined) {
            targetTab.focus();
            activateViewTab(targetTab);
          }
        }
      });
    });
  }
}
