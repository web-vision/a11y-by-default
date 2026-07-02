<?php

namespace Symfony\Component\DependencyInjection\Loader\Configurator;

use TYPO3\CMS\Core\Information\Typo3Version;

return static function (ContainerConfigurator $containerConfigurator): void {
    $majorVersion = (new Typo3Version())->getMajorVersion();
    $services = $containerConfigurator->services();

    $services->defaults()
        ->autowire()
        ->autoconfigure()
        ->private();

    // Only the implementation matching the running core major version is
    // registered; each one self-aliases to its interface via #[AsAlias],
    // the same mechanism TYPO3 core itself uses (e.g. ServerRequestFactory).
    $services->load(
        sprintf('WebVision\\A11yByDefault\\Core%d\\', $majorVersion),
        sprintf(__DIR__ . '/../Core%d/', $majorVersion),
    );
};
