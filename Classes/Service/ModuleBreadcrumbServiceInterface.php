<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Service;

use TYPO3\CMS\Backend\Template\ModuleTemplate;

/**
 * DocHeaderComponent::setMetaInformation() is deprecated since TYPO3 v14.2 in
 * favor of setPageBreadcrumb(), which does not exist on TYPO3 v13. The
 * Core13/Core14 implementations of this interface isolate that difference.
 */
interface ModuleBreadcrumbServiceInterface
{
    /**
     * @param array<string, mixed> $pageRecord
     */
    public function setPageBreadcrumb(ModuleTemplate $moduleTemplate, array $pageRecord): void;
}
