#!/usr/bin/env php
<?php

declare(strict_types=1);

/*
 * This file is part of the TYPO3 extension "a11y_by_default".
 *
 * It is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, either version 2
 * of the License, or any later version.
 *
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 */

use Symfony\Component\Finder\Finder;

require __DIR__ . '/../../.Build/vendor/autoload.php';

if (PHP_SAPI !== 'cli') {
    die('Script must be called from command line.' . chr(10));
}

/**
 * Check the extension's ReST documentation for structural integrity.
 *
 * Adapted from TYPO3 core's Build/Scripts/validateRstFiles.php, which only
 * validates Changelog snippets, to instead cover a regular extension manual:
 * every Documentation/*Index.rst file must include the shared
 * Includes.rst.txt, have a properly framed title, and carry a reference
 * target right above that title which is unique across the whole manual.
 *
 * If problems are found, they are printed to stdout and the script exits
 * with exit code 1.
 *
 * Optional argument: -d <directory> (defaults to "Documentation")
 */
final class ValidateRstFiles
{
    /** @var array<string, string> */
    private array $messages = [];

    private bool $isError = false;

    /** @var list<string> */
    private array $seenLinkTargets = [];

    public function __construct(
        private readonly string $baseDir = 'Documentation',
    ) {}

    public function validate(): int
    {
        printf('Searching for rst files in %s%s', $this->baseDir, chr(10));

        $errorCount = 0;
        foreach ($this->findFiles() as $file) {
            $this->clearMessages();
            $this->validateContent($file->getContents());

            if ($this->isError) {
                $errorCount++;
                $shortPath = ltrim(substr((string)$file, strlen($this->baseDir)), '/\\');
                printf('%s%s', $shortPath, chr(10));
                foreach ($this->messages as $title => $message) {
                    if ($message !== '') {
                        printf('  - %-11s %s%s', $title, $message, chr(10));
                    }
                }
            }
        }

        if ($errorCount > 0) {
            fwrite(STDERR, 'Found ' . $errorCount . ' rst file(s) with errors, see log above for details.' . chr(10));
            return 1;
        }

        return 0;
    }

    private function findFiles(): Finder
    {
        return (new Finder())
            ->files()
            ->in($this->baseDir)
            ->name('*.rst');
    }

    private function clearMessages(): void
    {
        $this->messages = [
            'include' => '',
            'title' => '',
            'linktarget' => '',
        ];
        $this->isError = false;
    }

    private function validateContent(string $fileContent): void
    {
        if (preg_match('#^\.\.\s+include::\s+/Includes\.rst\.txt#m', $fileContent) !== 1) {
            $this->setError('include', 'insert ".. include:: /Includes.rst.txt" as the first line of the file');
        }

        if (preg_match('#\={3,}\n.+\n\={3,}#', $fileContent) !== 1) {
            $this->setError('title', 'each document must have a title framed by lines of "=" above and below');
        }

        $this->validateLinkTarget($fileContent);
    }

    private function validateLinkTarget(string $fileContent): void
    {
        $result = preg_match('#\.\.\s+_([a-zA-Z0-9_-]+):\s*\={3,}\n.+\n\={3,}#', $fileContent, $matches);

        if ($result !== 1) {
            $this->setError(
                'linktarget',
                'each document must have a reference target (".. _some-label:") directly above its title',
            );
            return;
        }

        $linkTarget = $matches[1];
        if (in_array($linkTarget, $this->seenLinkTargets, true)) {
            $this->setError(
                'linktarget',
                'reference target "' . $linkTarget . '" is used by more than one document, targets must be unique across the whole manual',
            );
            return;
        }

        $this->seenLinkTargets[] = $linkTarget;
    }

    private function setError(string $type, string $message): void
    {
        $this->messages[$type] = $message;
        $this->isError = true;
    }
}

$options = getopt('d:');
$validator = new ValidateRstFiles(is_string($options['d'] ?? null) ? $options['d'] : 'Documentation');
exit($validator->validate());
