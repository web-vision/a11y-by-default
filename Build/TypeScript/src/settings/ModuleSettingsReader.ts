import { Typo3Backend } from '../backend/Typo3Backend';
import type { ContentFacts, ContentMetadataItem, ModuleSettings } from '../types';

export class ModuleSettingsReader {
  read(): ModuleSettings | null {
    const appEl = document.getElementById('a11y-app');
    if (appEl === null) {
      return null;
    }

    return {
      pageUid: parseInt(appEl.dataset['pageUid'] ?? '0', 10),
      previewUri: appEl.dataset['previewUri'] ?? '',
      contentMetadata: JSON.parse(appEl.dataset['contentMetadata'] ?? '[]') as ContentMetadataItem[],
      contentFacts: JSON.parse(appEl.dataset['contentFacts'] ?? '{}') as ContentFacts,
      axeJsUrl: appEl.dataset['axeJsUrl'] ?? '',
      htmlcsJsUrl: appEl.dataset['htmlcsJsUrl'] ?? '',
      classificationRules: Typo3Backend.getClassificationRules(),
    };
  }
}
