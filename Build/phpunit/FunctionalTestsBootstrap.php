<?php

/*
 * This file is part of the TYPO3 CMS project.
 *
 * It is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, either version 2
 * of the License, or any later version.
 *
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 *
 * The TYPO3 project - inspiring people to share!
 */

(static function () {
    $frameworkExtensions = [
        'Resources/Core/Functional/Extensions/json_response',
        'Resources/Core/Functional/Extensions/private_container',
    ];
    $composerPackageManager = new \TYPO3\TestingFramework\Composer\ComposerPackageManager();
    $testingFrameworkPath = $composerPackageManager->getPackageInfo('typo3/testing-framework')->getRealPath();
    foreach ($frameworkExtensions as $frameworkExtensionPath) {
        $packageInfo = $composerPackageManager->getPackageInfoWithFallback(
            rtrim($testingFrameworkPath, '/') . '/' . $frameworkExtensionPath
        );
        if ($packageInfo === null) {
            throw new \RuntimeException(
                sprintf(
                    'Could not preload "typo3/testing-framework" extension "%s".',
                    basename($frameworkExtensionPath),
                ),
                1751242001,
            );
        }
    }

    $testbase = new \TYPO3\TestingFramework\Core\Testbase();
    $testbase->defineOriginalRootPath();
    $testbase->createDirectory(ORIGINAL_ROOT . 'typo3temp/var/tests');
    $testbase->createDirectory(ORIGINAL_ROOT . 'typo3temp/var/transient');
})();
