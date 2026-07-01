<?php

declare(strict_types=1);

use TYPO3\CMS\Core\Utility\ExtensionManagementUtility;

defined('TYPO3') or die();

ExtensionManagementUtility::addTCAcolumns('be_groups', [
    'tx_a11ybydefault_developer_corner' => [
        'exclude' => true,
        'label' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang_db.xlf:be_groups.tx_a11ybydefault_developer_corner',
        'description' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang_db.xlf:be_groups.tx_a11ybydefault_developer_corner.description',
        'config' => [
            'type' => 'check',
            'renderType' => 'checkboxToggle',
            'default' => 0,
        ],
    ],
]);

ExtensionManagementUtility::addToAllTCAtypes(
    'be_groups',
    '--div--;LLL:EXT:a11y_by_default/Resources/Private/Language/locallang_db.xlf:be_groups.tab,tx_a11ybydefault_developer_corner',
);
