<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\EventListener;

use TYPO3\CMS\Backend\Controller\Event\ModifyPageLayoutContentEvent;
use TYPO3\CMS\Backend\Routing\PreviewUriBuilder;
use TYPO3\CMS\Backend\Routing\UriBuilder;
use TYPO3\CMS\Core\Attribute\AsEventListener;
use TYPO3\CMS\Core\Page\PageRenderer;
use WebVision\A11yByDefault\Service\PublicResourceUrlServiceInterface;

#[AsEventListener(identifier: 'a11y-by-default/page-layout-header')]
final class PageLayoutHeaderListener
{
    public function __construct(
        private readonly UriBuilder $uriBuilder,
        private readonly PageRenderer $pageRenderer,
        private readonly PublicResourceUrlServiceInterface $publicResourceUrlService,
    ) {}

    public function __invoke(ModifyPageLayoutContentEvent $event): void
    {
        $request = $event->getRequest();
        $pageId = (int)($request->getQueryParams()['id'] ?? 0);

        if ($pageId <= 0) {
            return;
        }

        $moduleUrl = (string)$this->uriBuilder->buildUriFromRoute('web_a11y_by_default', ['id' => $pageId]);
        $previewUri = (string)(PreviewUriBuilder::create($pageId)->buildUri() ?? '');
        $axeJsUrl = $this->publicResourceUrlService->getWebPath(
            'EXT:a11y_by_default/Resources/Public/JavaScript/Vendor/axe.min.js',
            $request,
        );

        $this->pageRenderer->loadJavaScriptModule('@web-vision/a11y-by-default/page-layout-summary.js');
        $this->pageRenderer->loadJavaScriptModule('@typo3/backend/element/progress-bar-element.js');
        $this->pageRenderer->loadJavaScriptModule('@typo3/backend/element/icon-element.js');
        $this->pageRenderer->addInlineLanguageLabelFile('EXT:a11y_by_default/Resources/Private/Language/locallang.xlf');

        $event->addHeaderContent(
            $this->renderSummaryContainerHtml($pageId, $previewUri, $axeJsUrl, $moduleUrl),
        );
    }

    private function renderSummaryContainerHtml(
        int $pageId,
        string $previewUri,
        string $axeJsUrl,
        string $moduleUrl,
    ): string {
        return sprintf(
            '<div id="a11y-page-summary-app"'
            . ' data-page-uid="%d"'
            . ' data-preview-uri="%s"'
            . ' data-axe-js-url="%s"'
            . ' data-module-url="%s">'
            . '</div>',
            $pageId,
            htmlspecialchars($previewUri, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
            htmlspecialchars($axeJsUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
            htmlspecialchars($moduleUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
        );
    }
}
