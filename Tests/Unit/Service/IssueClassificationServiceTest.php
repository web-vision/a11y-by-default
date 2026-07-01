<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Tests\Unit\Service;

use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\MockObject\MockObject;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\TestingFramework\Core\Unit\UnitTestCase;
use WebVision\A11yByDefault\Service\IssueClassificationService;

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

        $this->assertArrayHasKey('image-alt', $rules);
        $this->assertSame('editor', $rules['image-alt']['responsibility']);
    }

    #[Test]
    public function getClassificationRulesReturnsDeveloperRuleForColorContrast(): void
    {
        $rules = $this->subject->getClassificationRules();

        $this->assertArrayHasKey('color-contrast', $rules);
        $this->assertSame('developer', $rules['color-contrast']['responsibility']);
    }

    #[Test]
    public function getClassificationRulesReturnsDeveloperRuleForLandmarkOneMain(): void
    {
        $rules = $this->subject->getClassificationRules();

        $this->assertArrayHasKey('landmark-one-main', $rules);
        $this->assertSame('developer', $rules['landmark-one-main']['responsibility']);
    }

    #[Test]
    public function getClassificationRulesReturnsEditorRuleForHeadingOrder(): void
    {
        $rules = $this->subject->getClassificationRules();

        $this->assertArrayHasKey('heading-order', $rules);
        $this->assertSame('editor', $rules['heading-order']['responsibility']);
    }

    #[Test]
    public function getClassificationRulesReturnsDeveloperRuleForEmptyHeading(): void
    {
        $rules = $this->subject->getClassificationRules();

        $this->assertArrayHasKey('empty-heading', $rules);
        $this->assertSame('developer', $rules['empty-heading']['responsibility']);
    }

    #[Test]
    public function getClassificationRulesIncludesHintForEveryRule(): void
    {
        $rules = $this->subject->getClassificationRules();

        foreach ($rules as $ruleId => $rule) {
            $this->assertArrayHasKey('hint', $rule, sprintf('Rule "%s" is missing a hint.', $ruleId));
            $this->assertNotEmpty($rule['hint'], sprintf('Rule "%s" has an empty hint.', $ruleId));
        }
    }

    #[Test]
    public function getClassificationRulesIncludesDeveloperHintForEveryEditorRule(): void
    {
        $rules = $this->subject->getClassificationRules();

        foreach ($rules as $ruleId => $rule) {
            if ($rule['responsibility'] !== 'editor') {
                continue;
            }
            $this->assertArrayHasKey('developerHint', $rule, sprintf('Editor rule "%s" is missing a developerHint.', $ruleId));
            $this->assertNotEmpty($rule['developerHint'] ?? '', sprintf('Editor rule "%s" has an empty developerHint.', $ruleId));
        }
    }

    #[Test]
    public function getClassificationRulesReturnsExactlySeventeenRules(): void
    {
        $rules = $this->subject->getClassificationRules();

        $this->assertCount(17, $rules);
    }

    #[Test]
    public function getClassificationRulesContainsOnlyValidResponsibilityValues(): void
    {
        $rules = $this->subject->getClassificationRules();

        foreach ($rules as $ruleId => $rule) {
            $this->assertContains(
                $rule['responsibility'],
                ['editor', 'developer'],
                sprintf('Rule "%s" has unexpected responsibility "%s".', $ruleId, $rule['responsibility'])
            );
        }
    }
}
