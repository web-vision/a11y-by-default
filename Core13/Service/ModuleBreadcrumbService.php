<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Core13\Service;

use Symfony\Component\DependencyInjection\Attribute\AsAlias;
use TYPO3\CMS\Backend\Template\ModuleTemplate;
use WebVision\A11yByDefault\Service\ModuleBreadcrumbServiceInterface;

#[AsAlias(ModuleBreadcrumbServiceInterface::class)]
final class ModuleBreadcrumbService implements ModuleBreadcrumbServiceInterface
{
    public function setPageBreadcrumb(ModuleTemplate $moduleTemplate, array $pageRecord): void
    {
        $moduleTemplate->getDocHeaderComponent()->setMetaInformation($pageRecord);
    }
}
