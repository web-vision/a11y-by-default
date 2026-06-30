<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\EventListener;

use TYPO3\CMS\Backend\Controller\Event\ModifyPageLayoutContentEvent;
use TYPO3\CMS\Backend\Routing\UriBuilder;
use TYPO3\CMS\Core\Attribute\AsEventListener;

#[AsEventListener(identifier: 'a11y-by-default/page-layout-header')]
final class PageLayoutHeaderListener
{
    public function __construct(
        private readonly UriBuilder $uriBuilder,
    ) {}

    public function __invoke(ModifyPageLayoutContentEvent $event): void
    {
        $pageId = (int)($event->getRequest()->getQueryParams()['id'] ?? 0);

        if ($pageId <= 0) {
            return;
        }

        $moduleUrl = (string)$this->uriBuilder->buildUriFromRoute('web_a11y_by_default', ['id' => $pageId]);
        $event->addHeaderContent($this->renderHeaderHtml($moduleUrl));
    }

    private function renderHeaderHtml(string $moduleUrl): string
    {
        $escapedUrl = htmlspecialchars($moduleUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        return sprintf(
            '<div class="pa11y-page-hint t3-page-ce-header">'
            . '<a href="%s" class="btn btn-sm btn-default pa11y-page-hint__link" title="%s">'
            . '<span class="t3-icon t3js-icon icon icon-size-small" aria-hidden="true">'
            . '<img src="/typo3/sysext/core/Resources/Public/Icons/T3Icons/svgs/actions/actions-check-circle.svg" alt="" />'
            . '</span> %s</a></div>',
            $escapedUrl,
            htmlspecialchars('Check accessibility for this page', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
            htmlspecialchars('Check Accessibility', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
        );
    }
}
