<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Core14\Service;

use Psr\Http\Message\ServerRequestInterface;
use Symfony\Component\DependencyInjection\Attribute\AsAlias;
use TYPO3\CMS\Core\SystemResource\Publishing\SystemResourcePublisherInterface;
use TYPO3\CMS\Core\SystemResource\Publishing\UriGenerationOptions;
use TYPO3\CMS\Core\SystemResource\SystemResourceFactory;
use WebVision\A11yByDefault\Service\PublicResourceUrlServiceInterface;

#[AsAlias(PublicResourceUrlServiceInterface::class)]
final class PublicResourceUrlService implements PublicResourceUrlServiceInterface
{
    public function __construct(
        private readonly SystemResourceFactory $systemResourceFactory,
        private readonly SystemResourcePublisherInterface $resourcePublisher,
    ) {}

    public function getWebPath(string $extensionResourcePath, ServerRequestInterface $request): string
    {
        $resource = $this->systemResourceFactory->createPublicResource($extensionResourcePath);

        return (string)$this->resourcePublisher->generateUri($resource, $request, new UriGenerationOptions(cacheBusting: false));
    }
}
