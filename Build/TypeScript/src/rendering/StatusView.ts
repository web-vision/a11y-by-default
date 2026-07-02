import { Html } from './Html';
import { Typo3Backend } from '../backend/Typo3Backend';

export class StatusView {
  static showLoading(container: HTMLElement): void {
    container.innerHTML = `<typo3-backend-progress-bar
          label="${Html.escape(Typo3Backend.getLabel('module.loading'))}">
      </typo3-backend-progress-bar>`;
  }

  static showError(container: HTMLElement, message: string): void {
    container.innerHTML = `<div class="callout callout-danger a11y-error" role="alert">
          <div class="callout-body"><p>${Html.escape(message)}</p></div>
      </div>`;
  }
}
