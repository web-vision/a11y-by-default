<?php

declare(strict_types=1);

namespace WebVision\Pa11y\Tests\Functional\Service;

use PHPUnit\Framework\Attributes\Test;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;
use WebVision\Pa11y\Service\IssueClassificationService;

final class IssueClassificationServiceTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = ['pa11y'];

    #[Test]
    public function getPageContentMetadataReturnsEmptyArrayForPageWithNoContent(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');

        $subject = $this->get(IssueClassificationService::class);
        $result = $subject->getPageContentMetadata(1);

        self::assertSame([], $result);
    }

    #[Test]
    public function getPageContentMetadataReturnsContentElementsForPage(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/tt_content.csv');

        $subject = $this->get(IssueClassificationService::class);
        $result = $subject->getPageContentMetadata(1);

        self::assertCount(1, $result);
        self::assertSame(42, (int)$result[0]['uid']);
        self::assertSame('textmedia', $result[0]['CType']);
    }

    #[Test]
    public function getPageContentMetadataDoesNotReturnDeletedContent(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/tt_content_deleted.csv');

        $subject = $this->get(IssueClassificationService::class);
        $result = $subject->getPageContentMetadata(1);

        self::assertSame([], $result);
    }
}
