<?php

declare(strict_types=1);

$autoloadFile = realpath(__DIR__ . '/../../.Build/vendor/autoload.php');
if ($autoloadFile === false) {
    throw new \UnexpectedValueException('Could not resolve vendor autoload file.', 1751242000);
}

require $autoloadFile;
