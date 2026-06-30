<?php

declare(strict_types=1);

namespace WebVision\Pa11y\Tests\Unit\Service;

use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\MockObject\MockObject;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\TestingFramework\Core\Unit\UnitTestCase;
use WebVision\Pa11y\Service\IssueClassificationService;

final class IssueClassificationServiceTest extends UnitTestCase
{
    private IssueClassificationService $subject;

    /** @var ConnectionPool&MockObject */
    private ConnectionPool $connectionPoolMock;

    protected function setUp(): void
    {
        parent::setUp();
        $this->connectionPoolMock = $this->createMock(ConnectionPool::class);
        $this->subject = new IssueClassificationService($this->connectionPoolMock);
    }

    #[Test]
    public function getClassificationRulesReturnsEditorRuleForImageAlt(): void
    {
        $rules = $this->subject->getClassificationRules();

        self::assertArrayHasKey('image-alt', $rules);
        self::assertSame('editor', $rules['image-alt']['responsibility']);
    }

    #[Test]
    public function getClassificationRulesReturnsDeveloperRuleForColorContrast(): void
    {
        $rules = $this->subject->getClassificationRules();

        self::assertArrayHasKey('color-contrast', $rules);
        self::assertSame('developer', $rules['color-contrast']['responsibility']);
    }

    #[Test]
    public function getClassificationRulesReturnsDeveloperRuleForLandmarkOneMain(): void
    {
        $rules = $this->subject->getClassificationRules();

        self::assertArrayHasKey('landmark-one-main', $rules);
        self::assertSame('developer', $rules['landmark-one-main']['responsibility']);
    }

    #[Test]
    public function getClassificationRulesIncludesHintForEveryRule(): void
    {
        $rules = $this->subject->getClassificationRules();

        foreach ($rules as $ruleId => $rule) {
            self::assertArrayHasKey('hint', $rule, sprintf('Rule "%s" is missing a hint.', $ruleId));
            self::assertNotEmpty($rule['hint'], sprintf('Rule "%s" has an empty hint.', $ruleId));
        }
    }
}
