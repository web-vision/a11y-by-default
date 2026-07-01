<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Attribute\AsController;
use TYPO3\CMS\Backend\Routing\PreviewUriBuilder;
use TYPO3\CMS\Backend\Template\ModuleTemplateFactory;
use TYPO3\CMS\Core\Localization\LanguageService;
use TYPO3\CMS\Core\Localization\LanguageServiceFactory;
use TYPO3\CMS\Core\Page\PageRenderer;
use WebVision\A11yByDefault\Service\ContentFactsService;
use WebVision\A11yByDefault\Service\IssueClassificationService;

#[AsController]
final class A11yController
{
    public function __construct(
        private readonly ModuleTemplateFactory $moduleTemplateFactory,
        private readonly IssueClassificationService $classificationService,
        private readonly ContentFactsService $contentFactsService,
        private readonly PageRenderer $pageRenderer,
        private readonly LanguageServiceFactory $languageServiceFactory,
    ) {}

    public function index(ServerRequestInterface $request): ResponseInterface
    {
        $pageUid = (int)($request->getQueryParams()['id'] ?? 0);

        $previewUri = '';
        $contentMetadata = [];
        $contentFacts = [];

        if ($pageUid > 0) {
            $builtUri = PreviewUriBuilder::create($pageUid)->buildUri();
            $previewUri = $builtUri !== null ? (string)$builtUri : '';
            $contentMetadata = $this->classificationService->getPageContentMetadata($pageUid);
            $contentFacts = $this->contentFactsService->getContentFacts($pageUid);
        }

        $languageService = $this->languageServiceFactory->createFromUserPreferences($GLOBALS['BE_USER']);
        $resolvedRules = $this->resolveClassificationRules($languageService);

        $this->pageRenderer->loadJavaScriptModule('@web-vision/a11y-by-default/a11y-module.js');
        $this->pageRenderer->loadJavaScriptModule('@typo3/backend/element/progress-bar-element.js');
        $this->pageRenderer->addInlineLanguageLabelFile('EXT:a11y_by_default/Resources/Private/Language/locallang.xlf');
        $this->pageRenderer->addInlineSettingArray('a11yByDefault', [
            'classificationRules' => $resolvedRules,
        ]);

        $moduleTemplate = $this->moduleTemplateFactory->create($request);
        $moduleTemplate->assignMultiple([
            'pageUid' => $pageUid,
            'previewUri' => $previewUri,
            'contentMetadataJson' => json_encode($contentMetadata, JSON_THROW_ON_ERROR),
            'contentFactsJson' => json_encode($contentFacts, JSON_THROW_ON_ERROR),
        ]);

        return $moduleTemplate->renderResponse('A11y/Index');
    }

    /**
     * @return array<string, array{responsibility: string, hint: string, developerHint?: string}>
     */
    private function resolveClassificationRules(LanguageService $languageService): array
    {
        $resolvedRules = [];
        foreach ($this->classificationService->getClassificationRules() as $ruleId => $rule) {
            $resolvedRules[$ruleId] = [
                'responsibility' => $rule['responsibility'],
                'hint' => $languageService->sL($rule['hint']),
            ];
            if (isset($rule['developerHint'])) {
                $resolvedRules[$ruleId]['developerHint'] = $languageService->sL($rule['developerHint']);
            }
        }

        return $resolvedRules;
    }
}
