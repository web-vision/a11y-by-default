<?php

declare(strict_types=1);

namespace WebVision\Pa11y\Service;

use TYPO3\CMS\Core\Database\Connection;
use TYPO3\CMS\Core\Database\ConnectionPool;

final class IssueClassificationService
{
    private const CLASSIFICATION_RULES = [
        'image-alt' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.image-alt'],
        'input-image-alt' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.input-image-alt'],
        'area-alt' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.area-alt'],
        'empty-heading' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.empty-heading'],
        'link-name' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.link-name'],
        'td-headers-attr' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.td-headers-attr'],
        'th-has-data-cells' => ['responsibility' => 'editor', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.th-has-data-cells'],
        'landmark-one-main' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.landmark-one-main'],
        'region' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.region'],
        'bypass' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.bypass'],
        'html-has-lang' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.html-has-lang'],
        'html-lang-valid' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.html-lang-valid'],
        'color-contrast' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.color-contrast'],
        'meta-viewport' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.meta-viewport'],
        'frame-title' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.frame-title'],
        'scrollable-region-focusable' => ['responsibility' => 'developer', 'hint' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang.xlf:hint.scrollable-region-focusable'],
    ];

    public function __construct(
        private readonly ConnectionPool $connectionPool,
    ) {}

    /**
     * @return array<string, array{responsibility: string, hint: string}>
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
