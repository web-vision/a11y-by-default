<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Service;

use TYPO3\CMS\Core\Authentication\BackendUserAuthentication;

final class DeveloperCornerAccessService
{
    private const ACCESS_FIELD = 'tx_a11ybydefault_developer_corner';

    public function hasAccess(BackendUserAuthentication $backendUser): bool
    {
        if ($backendUser->isAdmin() || $backendUser->isSystemMaintainer()) {
            return true;
        }

        if ((bool)($backendUser->user[self::ACCESS_FIELD] ?? false)) {
            return true;
        }

        foreach ($backendUser->userGroups as $group) {
            if ((bool)($group[self::ACCESS_FIELD] ?? false)) {
                return true;
            }
        }

        return false;
    }
}
