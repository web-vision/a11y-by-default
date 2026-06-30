<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Controller;

use Psr\Http\Message\ResponseInterface;
use TYPO3\CMS\Backend\Routing\PreviewUriBuilder;
use TYPO3\CMS\Backend\Template\ModuleTemplateFactory;
use TYPO3\CMS\Core\Page\PageRenderer;
use TYPO3\CMS\Extbase\Mvc\Controller\ActionController;
use WebVision\A11yByDefault\Service\IssueClassificationService;

final class A11yController extends ActionController
{
    public function __construct(
        private readonly ModuleTemplateFactory $moduleTemplateFactory,
        private readonly IssueClassificationService $classificationService,
        private readonly PageRenderer $pageRenderer,
    ) {}

    public function indexAction(): ResponseInterface
    {
        $moduleTemplate = $this->moduleTemplateFactory->create($this->request);
        $pageUid = (int)($this->request->getQueryParams()['id'] ?? 0);

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

        $this->view->assignMultiple([
            'pageUid' => $pageUid,
            'previewUri' => $previewUri,
            'contentMetadataJson' => json_encode($contentMetadata, JSON_THROW_ON_ERROR),
        ]);

        $moduleTemplate->setContent($this->view->render());

        return $this->htmlResponse($moduleTemplate->renderContent());
    }
}
