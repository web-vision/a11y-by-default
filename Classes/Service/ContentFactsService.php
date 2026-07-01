<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Service;

use TYPO3\CMS\Core\Database\Connection;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Resource\Exception\ResourceDoesNotExistException;
use TYPO3\CMS\Core\Resource\File;
use TYPO3\CMS\Core\Resource\ProcessedFileRepository;
use TYPO3\CMS\Core\Resource\ResourceFactory;

/**
 * Builds per-content-element "ground truth" facts from the database (tt_content, FAL), so accessibility
 * findings can be correlated against real editable content instead of relying on template markup conventions.
 */
final class ContentFactsService
{
    private const RENDERED_HEADER_LAYOUTS = [1, 2, 3, 4, 5, 6];
    private const HIDDEN_HEADER_LAYOUT = 100;

    public function __construct(
        private readonly ConnectionPool $connectionPool,
        private readonly ResourceFactory $resourceFactory,
        private readonly ProcessedFileRepository $processedFileRepository,
    ) {}

    /**
     * @return array<int, array{headings: list<array{text: string, level: int|null}>, links: list<array{text: string, href: string}>, images: list<array{hasAltData: bool, matchers: list<string>}>, tables: list<array{cellTexts: list<string>}>}>
     */
    public function getContentFacts(int $pageUid): array
    {
        $contentRows = $this->getContentRows($pageUid);
        $contentUids = array_map(static fn(array $row): int => (int)$row['uid'], $contentRows);
        $imagesByUid = $this->getImageFactsGroupedByContentElement($contentUids);

        $facts = [];
        foreach ($contentRows as $row) {
            $uid = (int)$row['uid'];
            $facts[$uid] = [
                'headings' => $this->buildHeadingFacts($row),
                'links' => $this->buildLinkFacts($row),
                'images' => $imagesByUid[$uid] ?? [],
                'tables' => $this->buildTableFacts((string)$row['bodytext']),
            ];
        }

        return $facts;
    }

    /**
     * @return list<array{uid: int, header: string, header_layout: int, header_link: string, bodytext: string}>
     */
    private function getContentRows(int $pageUid): array
    {
        $queryBuilder = $this->connectionPool->getQueryBuilderForTable('tt_content');

        /** @var list<array{uid: int, header: string, header_layout: int, header_link: string, bodytext: string}> */
        return $queryBuilder
            ->select('uid', 'header', 'header_layout', 'header_link', 'bodytext')
            ->from('tt_content')
            ->where(
                $queryBuilder->expr()->eq('pid', $queryBuilder->createNamedParameter($pageUid, Connection::PARAM_INT))
            )
            ->executeQuery()
            ->fetchAllAssociative();
    }

    /**
     * @param array{header: string, header_layout: int, bodytext: string} $row
     * @return list<array{text: string, level: int|null}>
     */
    private function buildHeadingFacts(array $row): array
    {
        $headings = [];
        $headerText = trim((string)$row['header']);
        $headerLayout = (int)$row['header_layout'];

        if ($headerText !== '' && $headerLayout !== self::HIDDEN_HEADER_LAYOUT) {
            $level = in_array($headerLayout, self::RENDERED_HEADER_LAYOUTS, true) ? $headerLayout : null;
            $headings[] = ['text' => $headerText, 'level' => $level];
        }

        return [...$headings, ...$this->extractBodytextHeadings((string)$row['bodytext'])];
    }

    /**
     * @return list<array{text: string, level: int|null}>
     */
    private function extractBodytextHeadings(string $bodytext): array
    {
        $xpath = $this->createXPath($bodytext);
        $headings = [];
        foreach ($xpath->query('//h1 | //h2 | //h3 | //h4 | //h5 | //h6') ?: [] as $node) {
            if (!$node instanceof \DOMElement) {
                continue;
            }
            $text = trim($node->textContent);
            if ($text !== '') {
                $headings[] = ['text' => $text, 'level' => (int)substr($node->nodeName, 1)];
            }
        }

        return $headings;
    }

    /**
     * @param array{header: string, header_link: string, bodytext: string} $row
     * @return list<array{text: string, href: string}>
     */
    private function buildLinkFacts(array $row): array
    {
        $headerText = trim((string)$row['header']);
        $headerLink = trim((string)$row['header_link']);
        $links = $headerText !== '' && $headerLink !== '' ? [['text' => $headerText, 'href' => $headerLink]] : [];

        return [...$links, ...$this->extractBodytextLinks((string)$row['bodytext'])];
    }

    /**
     * @return list<array{text: string, href: string}>
     */
    private function extractBodytextLinks(string $bodytext): array
    {
        $xpath = $this->createXPath($bodytext);
        $links = [];
        foreach ($xpath->query('//a[@href]') ?: [] as $node) {
            if (!$node instanceof \DOMElement) {
                continue;
            }
            $text = trim($node->textContent);
            if ($text !== '') {
                $links[] = ['text' => $text, 'href' => $node->getAttribute('href')];
            }
        }

        return $links;
    }

    /**
     * @return list<array{cellTexts: list<string>}>
     */
    private function buildTableFacts(string $bodytext): array
    {
        $xpath = $this->createXPath($bodytext);
        $tables = [];
        foreach ($xpath->query('//table') ?: [] as $table) {
            if (!$table instanceof \DOMElement) {
                continue;
            }
            $cellTexts = [];
            foreach ($xpath->query('.//td | .//th', $table) ?: [] as $cell) {
                if (!$cell instanceof \DOMElement) {
                    continue;
                }
                $text = trim($cell->textContent);
                if ($text !== '') {
                    $cellTexts[] = $text;
                }
            }
            if ($cellTexts !== []) {
                $tables[] = ['cellTexts' => $cellTexts];
            }
        }

        return $tables;
    }

    private function createXPath(string $html): \DOMXPath
    {
        $document = new \DOMDocument();
        if (trim($html) !== '') {
            $previousErrorHandling = libxml_use_internal_errors(true);
            $document->loadHTML('<?xml encoding="utf-8"?><div>' . $html . '</div>', LIBXML_NOERROR | LIBXML_NOWARNING);
            libxml_use_internal_errors($previousErrorHandling);
        }

        return new \DOMXPath($document);
    }

    /**
     * @param list<int> $contentUids
     * @return array<int, list<array{hasAltData: bool, matchers: list<string>}>>
     */
    private function getImageFactsGroupedByContentElement(array $contentUids): array
    {
        if ($contentUids === []) {
            return [];
        }

        $grouped = [];
        foreach ($this->discoverFileReferences($contentUids) as $reference) {
            $imageFact = $this->buildImageFact((int)$reference['uid']);
            if ($imageFact !== null) {
                $grouped[(int)$reference['uid_foreign']][] = $imageFact;
            }
        }

        return $grouped;
    }

    /**
     * @param list<int> $contentUids
     * @return list<array{uid: int, uid_foreign: int}>
     */
    private function discoverFileReferences(array $contentUids): array
    {
        $queryBuilder = $this->connectionPool->getQueryBuilderForTable('sys_file_reference');

        /** @var list<array{uid: int, uid_foreign: int}> */
        return $queryBuilder
            ->select('uid', 'uid_foreign')
            ->from('sys_file_reference')
            ->where(
                $queryBuilder->expr()->eq('tablenames', $queryBuilder->createNamedParameter('tt_content')),
                $queryBuilder->expr()->in('uid_foreign', $queryBuilder->createNamedParameter($contentUids, Connection::PARAM_INT_ARRAY))
            )
            ->executeQuery()
            ->fetchAllAssociative();
    }

    /**
     * @return array{hasAltData: bool, matchers: list<string>}|null
     */
    private function buildImageFact(int $referenceUid): ?array
    {
        try {
            $fileReference = $this->resourceFactory->getFileReferenceObject($referenceUid);
        } catch (ResourceDoesNotExistException) {
            return null;
        }

        return [
            'hasAltData' => trim($fileReference->getAlternative()) !== '',
            'matchers' => $this->getFileMatchers($fileReference->getOriginalFile()),
        ];
    }

    /**
     * @return list<string>
     */
    private function getFileMatchers(File $originalFile): array
    {
        $matchers = [$originalFile->getName()];
        foreach ($this->processedFileRepository->findAllByOriginalFile($originalFile) as $processedFile) {
            $matchers[] = $processedFile->getName();
        }

        return $matchers;
    }
}
