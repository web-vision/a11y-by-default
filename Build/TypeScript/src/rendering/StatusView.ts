import { Html } from './Html';
import { Typo3Backend } from '../backend/Typo3Backend';

export class StatusView {
  static showLoading(container: HTMLElement): void {
    container.innerHTML = `<typo3-backend-progress-bar
          label="${Html.escape(Typo3Backend.getLabel('module.loading'))}">
      </typo3-backend-progress-bar>`;
  }

  // The detail carries the technical cause (an English error message) below
  // the translated message, so a failed scan still reads in the user's language.
  static showError(container: HTMLElement, message: string, detail = ''): void {
    const detailHtml = detail !== '' ? `<p class="small mb-0">${Html.escape(detail)}</p>` : '';
    container.innerHTML = `<div class="callout callout-danger a11y-error" role="alert">
          <div class="callout-body"><p>${Html.escape(message)}</p>${detailHtml}</div>
      </div>`;
  }
}
