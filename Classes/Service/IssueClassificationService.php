<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Service;

use TYPO3\CMS\Core\Database\Connection;
use TYPO3\CMS\Core\Database\ConnectionPool;

final class IssueClassificationService
{
    private const CLASSIFICATION_RULES = [
        'image-alt' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.image-alt', 'developerHint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.image-alt.developer'],
        'input-image-alt' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.input-image-alt', 'developerHint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.input-image-alt.developer'],
        'area-alt' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.area-alt', 'developerHint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.area-alt.developer'],
        'heading-order' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.heading-order', 'developerHint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.heading-order.developer'],
        'empty-heading' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.empty-heading'],
        'link-name' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.link-name', 'developerHint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.link-name.developer'],
        'td-headers-attr' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.td-headers-attr', 'developerHint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.td-headers-attr.developer'],
        'th-has-data-cells' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.th-has-data-cells', 'developerHint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.th-has-data-cells.developer'],
        'landmark-one-main' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.landmark-one-main'],
        'region' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.region'],
        'bypass' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.bypass'],
        'html-has-lang' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.html-has-lang'],
        'html-lang-valid' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.html-lang-valid'],
        'color-contrast' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.color-contrast'],
        'meta-viewport' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.meta-viewport'],
        'frame-title' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.frame-title'],
        'scrollable-region-focusable' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang.xlf:hint.scrollable-region-focusable'],
    ];

    public function __construct(
        private readonly ConnectionPool $connectionPool,
    ) {}

    /**
     * @return array<string, array{responsibility: string, hint: string, developerHint?: string}>
     */
    public function getClassificationRules(): array
    {
        return self::CLASSIFICATION_RULES;
    }

    /**
     * @return list<array{uid: int, CType: string, colPos: int, header: string, bodytext: string}>
     */
    public function getPageContentMetadata(int $pageUid): array
    {
        $queryBuilder = $this->connectionPool->getQueryBuilderForTable('tt_content');

        /** @var list<array{uid: int, CType: string, colPos: int, header: string, bodytext: string}> */
        return $queryBuilder
            ->select('uid', 'CType', 'colPos', 'header', 'bodytext')
            ->from('tt_content')
            ->where(
                $queryBuilder->expr()->eq('pid', $queryBuilder->createNamedParameter($pageUid, Connection::PARAM_INT))
            )
            ->executeQuery()
            ->fetchAllAssociative();
    }
}
