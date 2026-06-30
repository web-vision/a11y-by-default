<?php

declare(strict_types=1);

use WebVision\A11yByDefault\Controller\A11yController;

return [
    'web_a11y_by_default' => [
        'parent' => 'web',
        'position' => ['after' => 'web_layout'],
        'access' => 'user',
        'workspaces' => 'live',
        'iconIdentifier' => 'tx_a11y_by_default-module',
        'path' => '/module/web/a11y-by-default',
        'labels' => 'LLL:EXT:a11y_by_default/Resources/Private/Language/locallang_mod.xlf',
        'extensionName' => 'A11yByDefault',
        'controllerActions' => [
            A11yController::class => ['index'],
        ],
    ],
];
