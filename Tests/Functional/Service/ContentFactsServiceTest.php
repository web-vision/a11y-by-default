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
    #[DataProvider('rawImageValuesDataProvider')]
    public function getContentFactsReturnsRawAlternativeTitleAndFileName(
        int $contentUid,
        string $fileName,
        string $expectedAlternative,
        string $expectedTitle
    ): void {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/content_facts_image_titles.csv');

        $facts = $this->get(ContentFactsService::class)->getContentFacts(1);
        $image = $this->findImageByMatcher($facts[$contentUid]['images'], $fileName);

        $this->assertSame($expectedAlternative, $image['alternative']);
        $this->assertSame($expectedTitle, $image['title']);
        $this->assertSame($fileName, $image['fileName']);
        $this->assertArrayNotHasKey('altEqualsTitle', $image);
    }

    public static function rawImageValuesDataProvider(): \Generator
    {
        yield 'identical alt and title from metadata' => [
            'contentUid' => 71,
            'fileName' => 'title-metadata-identical.webp',
            'expectedAlternative' => 'Sunset over the bay',
            'expectedTitle' => 'Sunset over the bay',
        ];
        yield 'reference override wins over metadata' => [
            'contentUid' => 72,
            'fileName' => 'title-reference-override.webp',
            'expectedAlternative' => 'Override text',
            'expectedTitle' => 'Override text',
        ];
        yield 'differing alt and title' => [
            'contentUid' => 73,
            'fileName' => 'title-differing.webp',
            'expectedAlternative' => 'Sunset over the bay',
            'expectedTitle' => 'A photo by Max',
        ];
        yield 'stored values are not normalised' => [
            'contentUid' => 74,
            'fileName' => 'title-case-whitespace.webp',
            'expectedAlternative' => '  Sunset   over the BAY ',
            'expectedTitle' => 'sunset over the bay',
        ];
        yield 'null title becomes empty string' => [
            'contentUid' => 75,
            'fileName' => 'title-empty.webp',
            'expectedAlternative' => 'Sunset over the bay',
            'expectedTitle' => '',
        ];
        yield 'null alt becomes empty string' => [
            'contentUid' => 76,
            'fileName' => 'alt-empty.webp',
            'expectedAlternative' => '',
            'expectedTitle' => 'Sunset over the bay',
        ];
    }

    /**
     * @param list<array{hasAltData: bool, alternative: string, title: string, fileName: string, matchers: list<string>}> $images
     * @return array{hasAltData: bool, alternative: string, title: string, fileName: string, matchers: list<string>}
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
