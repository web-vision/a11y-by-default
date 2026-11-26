<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Tests\Functional\Service;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use TYPO3\CMS\Core\Core\Environment;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;
use WebVision\A11yByDefault\Service\ContentFactsService;

final class ContentFactsServiceTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = ['a11y_by_default'];

    protected function setUp(): void
    {
        parent::setUp();
        // The FAL objects touched by ContentFactsService (ProcessedFile construction) hash the original
        // file's content, so the referenced files must physically exist in the test instance's fileadmin/.
        file_put_contents(Environment::getPublicPath() . '/fileadmin/photo.webp', 'stub-image-content');
        file_put_contents(Environment::getPublicPath() . '/fileadmin/photo-with-alt.webp', 'stub-image-content');
        foreach (
            [
                'title-metadata-identical',
                'title-reference-override',
                'title-differing',
                'title-case-whitespace',
                'title-empty',
                'alt-empty',
            ] as $name
        ) {
            file_put_contents(Environment::getPublicPath() . '/fileadmin/' . $name . '.webp', 'stub-image-content');
        }
    }

    #[Test]
    public function getContentFactsExtractsHeaderFieldAsHeading(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_headings_links.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);

        $this->assertContains(['text' => 'Tset', 'level' => 1], $facts[51]['headings']);
    }

    #[Test]
    public function getContentFactsExcludesHeaderFieldWithHiddenLayout(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_headings_links.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);

        $this->assertSame([], $facts[54]['headings']);
    }

    #[Test]
    public function getContentFactsExtractsHeadingFromBodytext(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_headings_links.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);

        $this->assertContains(['text' => 'Inline Heading', 'level' => 4], $facts[52]['headings']);
    }

    #[Test]
    public function getContentFactsExtractsLinkFromBodytext(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_headings_links.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);

        $this->assertContains(['text' => 'Read more', 'href' => 'https://example.com'], $facts[52]['links']);
    }

    #[Test]
    public function getContentFactsCombinesHeaderAndHeaderLinkIntoALink(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_headings_links.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);

        $this->assertContains(
            ['text' => 'Camino Trail', 'href' => 'https://example.com/camino'],
            $facts[53]['links']
        );
    }

    #[Test]
    public function getContentFactsExtractsTableCellTextsFromBodytext(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_tables.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);

        $this->assertSame(['Name', 'Age', 'Alice', '30'], $facts[60]['tables'][0]['cellTexts']);
    }

    #[Test]
    public function getContentFactsMarksImageWithoutAlternativeAsMissingData(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_images.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);
        $image = $this->findImageByMatcher($facts[38]['images'], 'photo.webp');

        $this->assertFalse($image['hasAltData']);
    }

    #[Test]
    public function getContentFactsMarksImageWithAlternativeAsHavingData(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_images.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);
        $image = $this->findImageByMatcher($facts[38]['images'], 'photo-with-alt.webp');

        $this->assertTrue($image['hasAltData']);
    }

    #[Test]
    public function getContentFactsIncludesProcessedFileNamesAsMatchers(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_images.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);
        $image = $this->findImageByMatcher($facts[38]['images'], 'photo.webp');

        $this->assertContains('csm_photo_e169eb3b6d.webp', $image['matchers']);
    }

    #[Test]
    #[DataProvider('altEqualsTitleDataProvider')]
    public function getContentFactsReportsWhetherAltAndTitleAreEqual(
        int $contentUid,
        string $fileName,
        bool $expected
    ): void {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_image_titles.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);
        $image = $this->findImageByMatcher($facts[$contentUid]['images'], $fileName);

        $this->assertSame($expected, $image['altEqualsTitle']);
    }

    public static function altEqualsTitleDataProvider(): \Generator
    {
        yield 'identical alt and title from metadata' => [
            'contentUid' => 71,
            'fileName' => 'title-metadata-identical.webp',
            'expected' => true,
        ];
        yield 'identical alt and title via reference override' => [
            'contentUid' => 72,
            'fileName' => 'title-reference-override.webp',
            'expected' => true,
        ];
        yield 'differing alt and title' => [
            'contentUid' => 73,
            'fileName' => 'title-differing.webp',
            'expected' => false,
        ];
        yield 'case and whitespace only difference' => [
            'contentUid' => 74,
            'fileName' => 'title-case-whitespace.webp',
            'expected' => true,
        ];
        yield 'empty title' => [
            'contentUid' => 75,
            'fileName' => 'title-empty.webp',
            'expected' => false,
        ];
        yield 'empty alt' => [
            'contentUid' => 76,
            'fileName' => 'alt-empty.webp',
            'expected' => false,
        ];
    }

    /**
     * @param list<array{hasAltData: bool, altEqualsTitle: bool, matchers: list<string>}> $images
     * @return array{hasAltData: bool, altEqualsTitle: bool, matchers: list<string>}
     */
    private function findImageByMatcher(array $images, string $matcher): array
    {
        foreach ($images as $image) {
            if (in_array($matcher, $image['matchers'], true)) {
                return $image;
            }
        }

        $this->fail(sprintf('No image fact found with matcher "%s".', $matcher));
    }
}
