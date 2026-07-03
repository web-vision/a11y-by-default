<?php

$EM_CONF[$_EXTKEY] = [
    'title' => 'A11y by default - Accessibility Checker',
    'description' => 'Backend module for page-level accessibility checking using axe-core and HTML CodeSniffer, with editor/developer issue classification.',
    'category' => 'module',
    'author' => 'web-vision GmbH Team',
    'author_email' => 'hello@web-vision.de',
    'author_company' => 'web-vision GmbH',
    'state' => 'stable',
    'version' => '1.0.1',
    'constraints' => [
        'depends' => [
            'typo3' => '13.4.0-14.3.99',
            'php' => '8.2.0-8.5.99',
        ],
        'conflicts' => [],
        'suggests' => [],
    ],
];
