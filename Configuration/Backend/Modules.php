<?php

declare(strict_types=1);

use WebVision\Pa11y\Controller\Pa11yController;

return [
    'web_pa11y' => [
        'parent' => 'web',
        'position' => ['after' => 'web_layout'],
        'access' => 'user',
        'workspaces' => 'live',
        'iconIdentifier' => 'tx_pa11y-module',
        'path' => '/module/web/pa11y',
        'labels' => 'LLL:EXT:pa11y/Resources/Private/Language/locallang_mod.xlf',
        'extensionName' => 'Pa11y',
        'controllerActions' => [
            Pa11yController::class => ['index'],
        ],
    ],
];
