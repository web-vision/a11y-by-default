<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\EventListener;

use TYPO3\CMS\Backend\Controller\Event\ModifyPageLayoutContentEvent;
use TYPO3\CMS\Backend\Routing\PreviewUriBuilder;
use TYPO3\CMS\Backend\Routing\UriBuilder;
use TYPO3\CMS\Core\Attribute\AsEventListener;
use TYPO3\CMS\Core\Page\PageRenderer;
use TYPO3\CMS\Core\Utility\PathUtility;

#[AsEventListener(identifier: 'a11y-by-default/page-layout-header')]
final class PageLayoutHeaderListener
{
    public function __construct(
        private readonly UriBuilder $uriBuilder,
        private readonly PageRenderer $pageRenderer,
    ) {}

    public function __invoke(ModifyPageLayoutContentEvent $event): void
    {
        $pageId = (int)($event->getRequest()->getQueryParams()['id'] ?? 0);

        if ($pageId <= 0) {
            return;
        }

        $moduleUrl = (string)$this->uriBuilder->buildUriFromRoute('web_a11y_by_default', ['id' => $pageId]);
        $previewUri = (string)(PreviewUriBuilder::create($pageId)->buildUri() ?? '');
        $axeJsUrl = PathUtility::getPublicResourceWebPath(
            'EXT:a11y_by_default/Resources/Public/JavaScript/Vendor/axe.min.js',
        );

        $this->pageRenderer->loadJavaScriptModule('@web-vision/a11y-by-default/page-layout-summary.js');
        $this->pageRenderer->loadJavaScriptModule('@typo3/backend/element/progress-bar-element.js');
        $this->pageRenderer->addInlineLanguageLabelFile('EXT:a11y_by_default/Resources/Private/Language/locallang.xlf');

        $event->addHeaderContent(
            $this->renderButtonHtml($moduleUrl)
            . $this->renderSummaryContainerHtml($pageId, $previewUri, $axeJsUrl, $moduleUrl),
        );
    }

    private function renderButtonHtml(string $moduleUrl): string
    {
        return sprintf(
            '<div class="a11y-page-hint t3-page-ce-header">'
            . '<a href="%s" class="btn btn-sm btn-default a11y-page-hint__link" title="%s">'
            . '<span class="t3-icon t3js-icon icon icon-size-small" aria-hidden="true">'
            . '<img src="/typo3/sysext/core/Resources/Public/Icons/T3Icons/svgs/actions/actions-check-circle.svg" alt="" />'
            . '</span> %s</a></div>',
            htmlspecialchars($moduleUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
            htmlspecialchars('Check accessibility for this page', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
            htmlspecialchars('Check Accessibility', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
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
