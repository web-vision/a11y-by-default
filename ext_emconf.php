<?php

$EM_CONF[$_EXTKEY] = [
    'title' => 'Pa11y - Accessibility Checker',
    'description' => 'Backend module for page-level accessibility checking using axe-core and HTML CodeSniffer, with editor/developer issue classification.',
    'category' => 'module',
    'author' => 'Markus Hofmann',
    'author_email' => 'm.hofmann@web-vision.de',
    'author_company' => 'web-vision GmbH',
    'state' => 'alpha',
    'version' => '0.1.0',
    'constraints' => [
        'depends' => [
            'typo3' => '13.4.0-14.99.99',
            'php' => '8.2.0-8.99.99',
        ],
        'conflicts' => [],
        'suggests' => [],
    ],
];
