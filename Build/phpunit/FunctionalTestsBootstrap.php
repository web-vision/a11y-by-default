<?php

declare(strict_types=1);

$bootstrapFile = realpath(
    __DIR__ . '/../../.Build/vendor/typo3/testing-framework/Resources/Core/Build/FunctionalTestsBootstrap.php'
);
if ($bootstrapFile === false) {
    throw new \UnexpectedValueException('Could not resolve TYPO3 Testing Framework functional bootstrap.', 1751242001);
}

require $bootstrapFile;
