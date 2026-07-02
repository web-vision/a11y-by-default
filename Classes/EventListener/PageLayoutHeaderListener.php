<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\EventListener;

use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Controller\Event\ModifyPageLayoutContentEvent;
use TYPO3\CMS\Backend\Routing\PreviewUriBuilder;
use TYPO3\CMS\Backend\Routing\UriBuilder;
use TYPO3\CMS\Core\Attribute\AsEventListener;
use TYPO3\CMS\Core\Page\PageRenderer;
use WebVision\A11yByDefault\Service\ContentFactsService;
use WebVision\A11yByDefault\Service\DeveloperCornerAccessService;
use WebVision\A11yByDefault\Service\IssueClassificationService;
use WebVision\A11yByDefault\Service\PublicResourceUrlServiceInterface;

#[AsEventListener(identifier: 'a11y-by-default/page-layout-header')]
final class PageLayoutHeaderListener
{
    public function __construct(
        private readonly UriBuilder $uriBuilder,
        private readonly PageRenderer $pageRenderer,
        private readonly PublicResourceUrlServiceInterface $publicResourceUrlService,
        private readonly ContentFactsService $contentFactsService,
        private readonly IssueClassificationService $classificationService,
        private readonly DeveloperCornerAccessService $developerCornerAccessService,
    ) {}

    public function __invoke(ModifyPageLayoutContentEvent $event): void
    {
        $request = $event->getRequest();
        $pageId = (int)($request->getQueryParams()['id'] ?? 0);

        if ($pageId <= 0) {
            return;
        }

        $this->pageRenderer->loadJavaScriptModule('@web-vision/a11y-by-default/page-layout-summary.js');
        $this->pageRenderer->loadJavaScriptModule('@typo3/backend/element/progress-bar-element.js');
        $this->pageRenderer->loadJavaScriptModule('@typo3/backend/element/icon-element.js');
        $this->pageRenderer->addInlineLanguageLabelFile('EXT:a11y_by_default/Resources/Private/Language/locallang.xlf');

        $attributes = $this->buildSummaryAttributes($pageId, $request);
        $event->addHeaderContent($this->renderSummaryContainerHtml($attributes));
    }

    /**
     * @return array<string, string>
     */
    private function buildSummaryAttributes(int $pageId, ServerRequestInterface $request): array
    {
        $moduleUrl = (string)$this->uriBuilder->buildUriFromRoute('web_a11y_by_default', ['id' => $pageId]);
        $previewUri = (string)(PreviewUriBuilder::create($pageId)->buildUri() ?? '');
        $axeJsUrl = $this->publicResourceUrlService->getWebPath(
            'EXT:a11y_by_default/Resources/Public/JavaScript/Vendor/axe.min.js',
            $request,
        );
        $contentFacts = $this->contentFactsService->getContentFacts($pageId);
        $classificationRules = $this->classificationService->getClassificationRules();
        $hasDeveloperCornerAccess = $this->developerCornerAccessService->hasAccess($GLOBALS['BE_USER']);

        return [
            'data-page-uid' => (string)$pageId,
            'data-preview-uri' => $previewUri,
            'data-axe-js-url' => $axeJsUrl,
            'data-module-url' => $moduleUrl,
            'data-content-facts' => json_encode($contentFacts, JSON_THROW_ON_ERROR),
            'data-classification-rules' => json_encode($classificationRules, JSON_THROW_ON_ERROR),
            'data-has-developer-corner-access' => $hasDeveloperCornerAccess ? '1' : '0',
        ];
    }

    /**
     * @param array<string, string> $attributes
     */
    private function renderSummaryContainerHtml(array $attributes): string
    {
        $attributeMarkup = '';
        foreach ($attributes as $name => $value) {
            $attributeMarkup .= sprintf(
                ' %s="%s"',
                $name,
                htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
            );
        }

        return sprintf('<div id="a11y-page-summary-app"%s></div>', $attributeMarkup);
    }
}
