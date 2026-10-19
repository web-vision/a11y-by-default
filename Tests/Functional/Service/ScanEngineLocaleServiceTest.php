<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Tests\Functional\Service;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use TYPO3\CMS\Backend\Routing\Route;
use TYPO3\CMS\Core\Core\SystemEnvironmentBuilder;
use TYPO3\CMS\Core\Http\NormalizedParams;
use TYPO3\CMS\Core\Http\ServerRequest;
use TYPO3\CMS\Core\Localization\LanguageServiceFactory;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;
use WebVision\A11yByDefault\Service\ScanEngineLocaleService;

final class ScanEngineLocaleServiceTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = ['a11y_by_default'];

    private function createRequest(): ServerRequest
    {
        $route = new Route('/module/web/a11y-by-default', [
            '_identifier' => 'web_a11y_by_default',
            'packageName' => 'web-vision/a11y-by-default',
        ]);
        $request = (new ServerRequest('https://example.com/'))
            ->withAttribute('route', $route)
            ->withAttribute('applicationType', SystemEnvironmentBuilder::REQUESTTYPE_BE);

        return $request->withAttribute('normalizedParams', NormalizedParams::createFromRequest($request));
    }

    public static function axeLocaleDataProvider(): \Generator
    {
        yield 'German' => ['languageKey' => 'de', 'expectedPathEnd' => '/axe-locales/de.json'];
        yield 'Brazilian Portuguese' => ['languageKey' => 'pt_BR', 'expectedPathEnd' => '/axe-locales/pt_BR.json'];
        yield 'Portuguese, named differently by axe-core' => ['languageKey' => 'pt', 'expectedPathEnd' => '/axe-locales/pt_PT.json'];
        yield 'Norwegian, named differently by axe-core' => ['languageKey' => 'no', 'expectedPathEnd' => '/axe-locales/nb.json'];
        yield 'Traditional Chinese, named differently by axe-core' => ['languageKey' => 'zh', 'expectedPathEnd' => '/axe-locales/zh_TW.json'];
        yield 'Canadian French, falling back to French' => ['languageKey' => 'fr_CA', 'expectedPathEnd' => '/axe-locales/fr.json'];
    }

    /**
     * @param non-empty-string $expectedPathEnd
     */
    #[Test]
    #[DataProvider('axeLocaleDataProvider')]
    public function axeLocaleUrlPointsToTheLocaleOfTheBackendLanguage(string $languageKey, string $expectedPathEnd): void
    {
        $languageService = $this->get(LanguageServiceFactory::class)->create($languageKey);
        $subject = $this->get(ScanEngineLocaleService::class);

        $this->assertStringEndsWith($expectedPathEnd, $subject->getAxeLocaleUrl($languageService, $this->createRequest()));
    }

    public static function englishAxeMessagesDataProvider(): \Generator
    {
        yield 'English' => ['languageKey' => 'default'];
        yield 'a language axe-core ships no locale for' => ['languageKey' => 'fi'];
    }

    #[Test]
    #[DataProvider('englishAxeMessagesDataProvider')]
    public function axeLocaleUrlIsEmptyWhenAxeCoreKeepsItsEnglishMessages(string $languageKey): void
    {
        $languageService = $this->get(LanguageServiceFactory::class)->create($languageKey);
        $subject = $this->get(ScanEngineLocaleService::class);

        $this->assertSame('', $subject->getAxeLocaleUrl($languageService, $this->createRequest()));
    }

    #[Test]
    public function htmlCsLanguageIsTheBackendLanguageWhenHtmlCodeSnifferShipsIt(): void
    {
        $languageService = $this->get(LanguageServiceFactory::class)->create('fr_CA');
        $subject = $this->get(ScanEngineLocaleService::class);

        $this->assertSame('fr', $subject->getHtmlCsLanguage($languageService));
    }

    #[Test]
    public function htmlCsLanguageFallsBackToEnglish(): void
    {
        $languageService = $this->get(LanguageServiceFactory::class)->create('de');
        $subject = $this->get(ScanEngineLocaleService::class);

        $this->assertSame('en', $subject->getHtmlCsLanguage($languageService));
    }
}
