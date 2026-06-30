<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Tests\Functional\Service;

use PHPUnit\Framework\Attributes\Test;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;
use WebVision\A11yByDefault\Service\IssueClassificationService;

final class IssueClassificationServiceTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = ['a11y_by_default'];

    #[Test]
    public function getPageContentMetadataReturnsEmptyArrayForPageWithNoContent(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');

        $subject = $this->get(IssueClassificationService::class);
        $result = $subject->getPageContentMetadata(1);

        $this->assertSame([], $result);
    }

    #[Test]
    public function getPageContentMetadataReturnsContentElementsForPage(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/tt_content.csv');

        $subject = $this->get(IssueClassificationService::class);
        $result = $subject->getPageContentMetadata(1);

        $this->assertCount(1, $result);
        $this->assertSame(42, (int)$result[0]['uid']);
        $this->assertSame('textmedia', $result[0]['CType']);
    }

    #[Test]
    public function getPageContentMetadataDoesNotReturnDeletedContent(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/tt_content_deleted.csv');

        $subject = $this->get(IssueClassificationService::class);
        $result = $subject->getPageContentMetadata(1);

        $this->assertSame([], $result);
    }

    #[Test]
    public function getPageContentMetadataReturnsAllFields(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/tt_content.csv');

        $subject = $this->get(IssueClassificationService::class);
        $result = $subject->getPageContentMetadata(1);

        $this->assertCount(1, $result);
        $element = $result[0];
        $this->assertSame(42, (int)$element['uid']);
        $this->assertSame('textmedia', $element['CType']);
        $this->assertSame(0, (int)$element['colPos']);
        $this->assertSame('My Content Heading', $element['header']);
        $this->assertSame('Some body text', $element['bodytext']);
    }

    #[Test]
    public function getPageContentMetadataDoesNotReturnContentFromOtherPage(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/tt_content.csv');

        $subject = $this->get(IssueClassificationService::class);
        $result = $subject->getPageContentMetadata(2);

        $this->assertSame([], $result);
    }

    #[Test]
    public function getPageContentMetadataReturnsMultipleContentElements(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/tt_content_multiple.csv');

        $subject = $this->get(IssueClassificationService::class);
        $result = $subject->getPageContentMetadata(1);

        $this->assertCount(2, $result);
        $uids = array_map(static fn(array $row) => (int)$row['uid'], $result);
        $this->assertContains(10, $uids);
        $this->assertContains(11, $uids);
    }
}
