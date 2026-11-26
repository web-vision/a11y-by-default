<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Tests\Functional\EventListener;

use PHPUnit\Framework\Attributes\Test;
use TYPO3\CMS\Backend\Context\PageContextFactory;
use TYPO3\CMS\Backend\Controller\Event\ModifyPageLayoutContentEvent;
use TYPO3\CMS\Backend\Routing\Route;
use TYPO3\CMS\Backend\Routing\Router;
use TYPO3\CMS\Backend\Template\ModuleTemplateFactory;
use TYPO3\CMS\Core\Core\SystemEnvironmentBuilder;
use TYPO3\CMS\Core\Http\NormalizedParams;
use TYPO3\CMS\Core\Http\ServerRequest;
use TYPO3\CMS\Core\Localization\LanguageServiceFactory;
use TYPO3\CMS\Core\Site\Entity\Site;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;
use WebVision\A11yByDefault\EventListener\PageLayoutHeaderListener;

final class PageLayoutHeaderListenerTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = ['a11y_by_default'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/developer_corner_be_users.csv');
        $this->setUpBackendUser(1);
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
            ->withAttribute('route', $route)
            ->withAttribute('applicationType', SystemEnvironmentBuilder::REQUESTTYPE_BE);
        $request = $request->withAttribute('normalizedParams', NormalizedParams::createFromRequest($request));
        $request = $request->withAttribute('site', new Site('test', 1, ['base' => 'https://example.com/']));
        $moduleTemplate = $this->get(ModuleTemplateFactory::class)->create($request);

        // TYPO3 14.3 requires a PageContext as third constructor argument, 13.4 accepts two arguments only.
        // Reflection keeps a single test helper that static analysis accepts on both cores.
        $eventReflection = new \ReflectionClass(ModifyPageLayoutContentEvent::class);
        $arguments = [$request, $moduleTemplate];
        if ($eventReflection->getConstructor()?->getNumberOfParameters() === 3 && class_exists(PageContextFactory::class)) {
            $arguments[] = $this->get(PageContextFactory::class)->createFromRequest(
                $request,
                (int)($queryParams['id'] ?? 0),
                $GLOBALS['BE_USER'],
            );
        }

        return $eventReflection->newInstanceArgs($arguments);
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

    #[Test]
    public function headerContainsDeveloperCornerAccessFlagForAdmin(): void
    {
        $listener = $this->get(PageLayoutHeaderListener::class);
        $event = $this->createEvent(['id' => 1]);
        $listener($event);
        $this->assertStringContainsString('data-has-developer-corner-access="1"', $event->getHeaderContent());
    }

    #[Test]
    public function headerContainsDeveloperCornerAccessFlagForEditorWithoutAccess(): void
    {
        $this->setUpBackendUser(4);
        $listener = $this->get(PageLayoutHeaderListener::class);
        $event = $this->createEvent(['id' => 1]);
        $listener($event);
        $this->assertStringContainsString('data-has-developer-corner-access="0"', $event->getHeaderContent());
    }

    #[Test]
    public function headerContainsClassificationRules(): void
    {
        $listener = $this->get(PageLayoutHeaderListener::class);
        $event = $this->createEvent(['id' => 1]);
        $listener($event);
        $this->assertStringContainsString('data-classification-rules=', $event->getHeaderContent());
        $this->assertStringContainsString('image-alt', $event->getHeaderContent());
    }

    #[Test]
    public function headerContainsContentFacts(): void
    {
        $listener = $this->get(PageLayoutHeaderListener::class);
        $event = $this->createEvent(['id' => 1]);
        $listener($event);
        $this->assertStringContainsString('data-content-facts=', $event->getHeaderContent());
    }
}
