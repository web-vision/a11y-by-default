import { Html } from './Html';
import { Typo3Backend } from '../backend/Typo3Backend';

export class ContentElementEditLink {
  static build(contentElementUid: number): string {
    const moduleUrl = Typo3Backend.getRecordEditModuleUrl();
    if (moduleUrl === undefined || moduleUrl === '') {
      return '';
    }

    const label = `Edit content element #${contentElementUid}`;
    const linkClasses = 'btn btn-sm btn-default mb-2 d-inline-block';
    const returnUrl = encodeURIComponent(window.location.href);
    const editHref = `${moduleUrl}&edit[tt_content][${contentElementUid}]=edit&module=web_a11y_by_default&returnUrl=${returnUrl}`;

    const contextualModuleUrl = Typo3Backend.getContextualEditModuleUrl();
    if (contextualModuleUrl !== undefined && contextualModuleUrl !== null && contextualModuleUrl !== '') {
      const contextualHref = `${contextualModuleUrl}&edit[tt_content][${contentElementUid}]=edit&module=web_a11y_by_default&returnUrl=${returnUrl}`;

      return `<typo3-backend-contextual-record-edit-trigger url="${Html.escape(contextualHref)}" edit-url="${Html.escape(editHref)}"
                 class="${linkClasses}">${label}</typo3-backend-contextual-record-edit-trigger>`;
    }

    return `<a href="${Html.escape(editHref)}"
                 class="${linkClasses}">${label}</a>`;
  }
}
