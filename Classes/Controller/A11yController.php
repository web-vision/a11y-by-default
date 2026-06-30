<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Attribute\AsController;
use TYPO3\CMS\Backend\Routing\PreviewUriBuilder;
use TYPO3\CMS\Backend\Template\ModuleTemplateFactory;
use TYPO3\CMS\Core\Page\PageRenderer;
use WebVision\A11yByDefault\Service\IssueClassificationService;

#[AsController]
final class A11yController
{
    public function __construct(
        private readonly ModuleTemplateFactory $moduleTemplateFactory,
        private readonly IssueClassificationService $classificationService,
        private readonly PageRenderer $pageRenderer,
    ) {}

    public function index(ServerRequestInterface $request): ResponseInterface
    {
        $pageUid = (int)($request->getQueryParams()['id'] ?? 0);

        $previewUri = '';
        $contentMetadata = [];

        if ($pageUid > 0) {
            $builtUri = PreviewUriBuilder::create($pageUid)->buildUri();
            $previewUri = $builtUri !== null ? (string)$builtUri : '';
            $contentMetadata = $this->classificationService->getPageContentMetadata($pageUid);
        }

        $this->pageRenderer->loadJavaScriptModule('@web-vision/a11y-by-default/a11y-module');
        $this->pageRenderer->addInlineSettingArray('a11yByDefault', [
            'classificationRules' => $this->classificationService->getClassificationRules(),
        ]);

        $moduleTemplate = $this->moduleTemplateFactory->create($request);
        $moduleTemplate->assignMultiple([
            'pageUid' => $pageUid,
            'previewUri' => $previewUri,
            'contentMetadataJson' => json_encode($contentMetadata, JSON_THROW_ON_ERROR),
        ]);

        return $moduleTemplate->renderResponse('A11y/Index');
    }
}
