<?php

declare(strict_types=1);

use TYPO3\CMS\Core\Imaging\IconProvider\SvgIconProvider;

return [
    'tx_a11y_by_default-module' => [
        'provider' => SvgIconProvider::class,
        'source' => 'EXT:a11y_by_default/Resources/Public/Icons/Extension.svg',
    ],
];
