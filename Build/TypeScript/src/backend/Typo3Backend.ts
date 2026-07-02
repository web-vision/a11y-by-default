import type { ClassificationRule } from '../types';

// Static accessors for the backend's global TYPO3 object — the module runs
// inside the backend's content iframe and reads labels/settings TYPO3 core
// (or A11yController) already put on `window.TYPO3`.
export class Typo3Backend {
  static getLabel(key: string): string {
    const typo3 = (window as unknown as Record<string, unknown>).TYPO3 as { lang?: Record<string, string> } | undefined;
    return typo3?.lang?.[key] ?? key;
  }

  static getClassificationRules(): Record<string, ClassificationRule> {
    const typo3Settings = (window as unknown as Record<string, unknown>).TYPO3 as
      { settings?: { a11yByDefault?: { classificationRules?: Record<string, ClassificationRule> } } } | undefined;
    return typo3Settings?.settings?.a11yByDefault?.classificationRules ?? {};
  }

  // Only the outer/top backend document carries a valid, signed route token for
  // record/edit (set by TYPO3's BackendController as TYPO3.settings.FormEngine.moduleUrl)
  // — the same base URL TYPO3 core itself reuses in multi-record-selection-edit-action.js.
  // Minting a token client-side is not possible, so this pre-tokenized URL must be extended.
  static getRecordEditModuleUrl(): string | undefined {
    const topWindow = (window.top ?? window) as unknown as Record<string, unknown>;
    const typo3 = topWindow['TYPO3'] as { settings?: { FormEngine?: { moduleUrl?: string } } } | undefined;
    return typo3?.settings?.FormEngine?.moduleUrl;
  }

  // The contextual (side-panel) edit route is only available from TYPO3 v14 onward.
  // A11yController only emits this setting when the route exists on the running core.
  static getContextualEditModuleUrl(): string | null | undefined {
    const typo3 = (window as unknown as Record<string, unknown>).TYPO3 as
      { settings?: { a11yByDefault?: { contextualEditModuleUrl?: string | null } } } | undefined;
    return typo3?.settings?.a11yByDefault?.contextualEditModuleUrl;
  }
}
