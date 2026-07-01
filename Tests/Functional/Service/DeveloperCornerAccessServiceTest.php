<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Tests\Functional\Service;

use PHPUnit\Framework\Attributes\Test;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;
use WebVision\A11yByDefault\Service\DeveloperCornerAccessService;

final class DeveloperCornerAccessServiceTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = ['a11y_by_default'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/developer_corner_be_users.csv');
    }

    #[Test]
    public function adminAlwaysHasAccess(): void
    {
        $this->setUpBackendUser(1);
        $service = $this->get(DeveloperCornerAccessService::class);

        $this->assertTrue($service->hasAccess($GLOBALS['BE_USER']));
    }

    #[Test]
    public function editorWithOwnFlagHasAccess(): void
    {
        $this->setUpBackendUser(2);
        $service = $this->get(DeveloperCornerAccessService::class);

        $this->assertTrue($service->hasAccess($GLOBALS['BE_USER']));
    }

    #[Test]
    public function editorInAGroupWithTheFlagHasAccess(): void
    {
        $this->setUpBackendUser(3);
        $service = $this->get(DeveloperCornerAccessService::class);

        $this->assertTrue($service->hasAccess($GLOBALS['BE_USER']));
    }

    #[Test]
    public function editorWithoutFlagAndWithoutMatchingGroupHasNoAccess(): void
    {
        $this->setUpBackendUser(4);
        $service = $this->get(DeveloperCornerAccessService::class);

        $this->assertFalse($service->hasAccess($GLOBALS['BE_USER']));
    }
}
