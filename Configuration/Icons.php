<?php

declare(strict_types=1);

use TYPO3\CMS\Core\Imaging\IconProvider\SvgIconProvider;
use TYPO3\CMS\Core\Information\Typo3Version;

$isTYPO3v14OrHigher = (new Typo3Version())->getMajorVersion() >= 14;

return [
    'tx_a11y_by_default-module' => [
        'provider' => SvgIconProvider::class,
        'source' => $isTYPO3v14OrHigher
            ? 'EXT:a11y_by_default/Resources/Public/Icons/Extension-v14.svg'
            : 'EXT:a11y_by_default/Resources/Public/Icons/Extension.svg',
    ],
    'ext-a11y_by_default-check-accessibility' => [
        'provider' => SvgIconProvider::class,
        'source' => 'EXT:a11y_by_default/Resources/Public/Icons/actions-check-accessibility.svg',
    ],
];
