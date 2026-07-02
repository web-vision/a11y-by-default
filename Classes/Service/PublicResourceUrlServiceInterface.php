<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Service;

use Psr\Http\Message\ServerRequestInterface;

/**
 * PathUtility::getPublicResourceWebPath() is deprecated since TYPO3 v14.0 in
 * favor of the System Resource API, which does not exist on TYPO3 v13. The
 * Core13/Core14 implementations of this interface isolate that difference.
 */
interface PublicResourceUrlServiceInterface
{
    public function getWebPath(string $extensionResourcePath, ServerRequestInterface $request): string;
}
