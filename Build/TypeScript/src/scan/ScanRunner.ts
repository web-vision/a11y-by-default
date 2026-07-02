import { buildContentFactsIndex } from '../ContentFacts';
import { AxeEngine } from '../engines/AxeEngine';
import { HtmlCsEngine } from '../engines/HtmlCsEngine';
import type { ModuleSettings, ScanEngine, ScanResult } from '../types';

export class ScanRunner {
  async run(settings: ModuleSettings, engine: ScanEngine): Promise<ScanResult> {
    const iframe = document.createElement('iframe');
    iframe.src = settings.previewUri;
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.title = 'Accessibility scan preview';

    document.body.appendChild(iframe);

    try {
      await this.waitForLoad(iframe);

      const contentFactsIndex = buildContentFactsIndex(settings.contentFacts);
      const scanEngine =
        engine === 'axe'
          ? new AxeEngine(iframe, settings.axeJsUrl, contentFactsIndex)
          : new HtmlCsEngine(iframe, settings.htmlcsJsUrl, contentFactsIndex);

      return await scanEngine.run();
    } finally {
      iframe.remove();
    }
  }

  private waitForLoad(iframe: HTMLIFrameElement): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Iframe load timeout after 30s')), 30000);
      iframe.addEventListener(
        'load',
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      iframe.addEventListener(
        'error',
        () => {
          window.clearTimeout(timeout);
          reject(new Error('Iframe failed to load'));
        },
        { once: true },
      );
    });
  }
}
