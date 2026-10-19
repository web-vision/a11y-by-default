<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Tests\Functional\Controller;

use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\Test;
use TYPO3\CMS\Backend\Routing\Route;
use TYPO3\CMS\Backend\Routing\Router;
use TYPO3\CMS\Core\Core\SystemEnvironmentBuilder;
use TYPO3\CMS\Core\Http\NormalizedParams;
use TYPO3\CMS\Core\Http\ServerRequest;
use TYPO3\CMS\Core\Localization\LanguageServiceFactory;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;
use WebVision\A11yByDefault\Controller\A11yController;

final class A11yControllerTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = ['a11y_by_default'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/be_users.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');
        $this->setUpBackendUser(1);
        $GLOBALS['LANG'] = $this->get(LanguageServiceFactory::class)->create('default');

        $route = new Route('/module/web/a11y-by-default', [
            '_identifier' => 'web_a11y_by_default',
            'packageName' => 'web-vision/a11y-by-default',
        ]);
        $this->get(Router::class)->addRoute('web_a11y_by_default', $route);
    }

    private function createRequest(int $pageUid): ServerRequest
    {
        $route = new Route('/module/web/a11y-by-default', [
            '_identifier' => 'web_a11y_by_default',
            'packageName' => 'web-vision/a11y-by-default',
        ]);

        $request = (new ServerRequest('https://example.com/'))
            ->withQueryParams(['id' => $pageUid])
            ->withAttribute('route', $route)
            ->withAttribute('applicationType', SystemEnvironmentBuilder::REQUESTTYPE_BE);

        return $request->withAttribute('normalizedParams', NormalizedParams::createFromRequest($request));
    }

    #[Test]
    #[Group('not-core-14')]
    public function contextualEditModuleUrlIsNullWhenTheRunningCoreHasNoSidePanelEditRoute(): void
    {
        $controller = $this->get(A11yController::class);
        $response = $controller->index($this->createRequest(1));
        $body = (string)$response->getBody();

        // The installed TYPO3 core version for this test run does not ship
        // ContextualRecordEditController (introduced in v14), so the module
        // must gracefully fall back to the classic full-page edit link.
        $this->assertStringContainsString('"contextualEditModuleUrl":null', $body);
    }

    #[Test]
    public function moduleRendersSuccessfullyForAPageWithoutContent(): void
    {
        $controller = $this->get(A11yController::class);
        $response = $controller->index($this->createRequest(1));

        $this->assertSame(200, $response->getStatusCode());
    }

    #[Test]
    public function scanEnginesUseTheLanguageOfTheBackendUser(): void
    {
        $GLOBALS['BE_USER']->user['lang'] = 'de';

        $controller = $this->get(A11yController::class);
        $response = $controller->index($this->createRequest(1));
        $body = (string)$response->getBody();

        $this->assertMatchesRegularExpression('#data-axe-locale-url="[^"]+/axe-locales/de\.json"#', $body);
        // HTML CodeSniffer ships no German translation.
        $this->assertStringContainsString('data-htmlcs-language="en"', $body);
    }

    #[Test]
    public function scanEnginesKeepTheirEnglishMessagesForEnglishBackendUsers(): void
    {
        $controller = $this->get(A11yController::class);
        $response = $controller->index($this->createRequest(1));
        $body = (string)$response->getBody();

        $this->assertStringContainsString('data-axe-locale-url=""', $body);
        $this->assertStringContainsString('data-htmlcs-language="en"', $body);
    }

    #[Test]
    public function developerViewTabIsRenderedForAdmins(): void
    {
        $controller = $this->get(A11yController::class);
        $response = $controller->index($this->createRequest(1));
        $body = (string)$response->getBody();

        $this->assertStringContainsString('id="a11y-view-tab-developer"', $body);
    }

    #[Test]
    public function developerViewTabIsNotRenderedForEditorsWithoutDeveloperCornerAccess(): void
    {
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/developer_corner_be_users_non_admin.csv');
        $this->setUpBackendUser(4);

        $controller = $this->get(A11yController::class);
        $response = $controller->index($this->createRequest(1));
        $body = (string)$response->getBody();

        $this->assertStringNotContainsString('id="a11y-view-tab-developer"', $body);
    }
}
