<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Core13\Service;

use Psr\Http\Message\ServerRequestInterface;
use Symfony\Component\DependencyInjection\Attribute\AsAlias;
use TYPO3\CMS\Core\Utility\PathUtility;
use WebVision\A11yByDefault\Service\PublicResourceUrlServiceInterface;

#[AsAlias(PublicResourceUrlServiceInterface::class)]
final class PublicResourceUrlService implements PublicResourceUrlServiceInterface
{
    public function getWebPath(string $extensionResourcePath, ServerRequestInterface $request): string
    {
        return PathUtility::getPublicResourceWebPath($extensionResourcePath);
    }
}
