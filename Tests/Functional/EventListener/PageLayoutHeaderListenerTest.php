<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Tests\Functional\EventListener;

use PHPUnit\Framework\Attributes\Test;
use TYPO3\CMS\Backend\Controller\Event\ModifyPageLayoutContentEvent;
use TYPO3\CMS\Backend\Routing\Route;
use TYPO3\CMS\Backend\Routing\Router;
use TYPO3\CMS\Backend\Template\ModuleTemplateFactory;
use TYPO3\CMS\Core\Http\ServerRequest;
use TYPO3\CMS\Core\Localization\LanguageServiceFactory;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;
use WebVision\A11yByDefault\EventListener\PageLayoutHeaderListener;

final class PageLayoutHeaderListenerTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = ['a11y_by_default'];

    protected function setUp(): void
    {
        parent::setUp();
        $GLOBALS['LANG'] = $this->get(LanguageServiceFactory::class)->create('default');
        $this->get(Router::class)->addRoute(
            'web_a11y_by_default',
            new Route('/module/web/a11y-by-default', [
                '_identifier' => 'web_a11y_by_default',
                'packageName' => 'web-vision/a11y-by-default',
            ])
        );
    }

    /**
     * @param array<array-key, mixed> $queryParams
     */
    private function createEvent(array $queryParams): ModifyPageLayoutContentEvent
    {
        $route = new Route('/module/web/a11y-by-default', [
            '_identifier' => 'web_a11y_by_default',
            'packageName' => 'web-vision/a11y-by-default',
        ]);
        $request = (new ServerRequest('https://example.com/'))
            ->withQueryParams($queryParams)
            ->withAttribute('route', $route);
        $moduleTemplate = $this->get(ModuleTemplateFactory::class)->create($request);
        return new ModifyPageLayoutContentEvent($request, $moduleTemplate);
    }

    #[Test]
    public function doesNothingWhenPageIdIsZero(): void
    {
        $listener = $this->get(PageLayoutHeaderListener::class);
        $event = $this->createEvent(['id' => 0]);
        $listener($event);
        $this->assertSame('', $event->getHeaderContent());
    }

    #[Test]
    public function doesNothingWhenPageIdIsAbsent(): void
    {
        $listener = $this->get(PageLayoutHeaderListener::class);
        $event = $this->createEvent([]);
        $listener($event);
        $this->assertSame('', $event->getHeaderContent());
    }

    #[Test]
    public function addsHeaderContentForPositivePageId(): void
    {
        $listener = $this->get(PageLayoutHeaderListener::class);
        $event = $this->createEvent(['id' => 1]);
        $listener($event);
        $this->assertNotSame('', $event->getHeaderContent());
    }

    #[Test]
    public function headerContainsLinkToAccessibilityModule(): void
    {
        $listener = $this->get(PageLayoutHeaderListener::class);
        $event = $this->createEvent(['id' => 1]);
        $listener($event);
        $this->assertStringContainsString('/module/web/a11y-by-default', $event->getHeaderContent());
    }

    #[Test]
    public function headerContainsPageId(): void
    {
        $listener = $this->get(PageLayoutHeaderListener::class);
        $event = $this->createEvent(['id' => 42]);
        $listener($event);
        $this->assertStringContainsString('id=42', $event->getHeaderContent());
    }
}
