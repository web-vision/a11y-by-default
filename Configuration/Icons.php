<?php

declare(strict_types=1);

use TYPO3\CMS\Core\Imaging\IconProvider\SvgIconProvider;

return [
    'tx_pa11y-module' => [
        'provider' => SvgIconProvider::class,
        'source' => 'EXT:pa11y/Resources/Public/Icons/Extension.svg',
    ],
];
