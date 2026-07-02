import './CodeViewer';
import { FilterController } from './filtering/FilterController';
import { ViewTabController } from './filtering/ViewTabController';
import { ResultsRenderer } from './rendering/ResultsRenderer';
import { StatusView } from './rendering/StatusView';
import { ScanRunner } from './scan/ScanRunner';
import { ModuleSettingsReader } from './settings/ModuleSettingsReader';
import { Typo3Backend } from './backend/Typo3Backend';
import { ViolationClassifier } from './ViolationClassifier';
import type { ScanEngine } from './types';

export class A11yModule {
  private readonly settingsReader = new ModuleSettingsReader();
  private readonly filterController = new FilterController();
  private readonly viewTabController = new ViewTabController(this.filterController);
  private readonly scanRunner = new ScanRunner();

  initialize(): void {
    const settings = this.settingsReader.read();
    if (settings === null || settings.pageUid === 0) {
      return;
    }

    const resultsContainer = document.getElementById('a11y-results');
    const scanButton = document.getElementById('a11y-scan-button');
    const engineSelect = document.getElementById('a11y-engine-select') as HTMLSelectElement | null;

    if (resultsContainer === null || scanButton === null) {
      return;
    }

    if (settings.previewUri === '') {
      StatusView.showError(resultsContainer, Typo3Backend.getLabel('module.error.noPreview'));
      return;
    }

    const executeScan = async (): Promise<void> => {
      const engine: ScanEngine = (engineSelect?.value ?? 'axe') as ScanEngine;
      scanButton.setAttribute('disabled', 'disabled');
      StatusView.showLoading(resultsContainer);

      try {
        const result = await this.scanRunner.run(settings, engine);
        const classifier = new ViolationClassifier(settings.classificationRules);
        new ResultsRenderer(classifier, this.filterController).render(resultsContainer, result);
      } catch (error) {
        StatusView.showError(
          resultsContainer,
          error instanceof Error ? error.message : Typo3Backend.getLabel('module.error.scanFailed'),
        );
      } finally {
        scanButton.removeAttribute('disabled');
      }
    };

    this.filterController.bindSeverityToggles(resultsContainer);
    this.viewTabController.bind(resultsContainer);

    scanButton.addEventListener('click', executeScan);
    executeScan();
  }
}

export function initialize(): void {
  new A11yModule().initialize();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
