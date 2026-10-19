<?php

declare(strict_types=1);

namespace WebVision\A11yByDefault\Service;

use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Core\Localization\LanguageService;
use TYPO3\CMS\Core\Localization\Locale;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * Selects the language the scanning engines write their findings in, so that
 * backend users read them in their own language. English stays the fallback
 * whenever an engine ships no translation for that language.
 */
final class ScanEngineLocaleService
{
    /**
     * Copied from node_modules/axe-core/locales/ by "npm run build:vendor".
     */
    private const AXE_LOCALE_FILE = 'EXT:a11y_by_default/Resources/Public/JavaScript/Vendor/axe-locales/%s.json';

    /**
     * TYPO3 language keys that axe-core names differently.
     */
    private const AXE_LOCALE_ALIASES = [
        'no' => 'nb',
        'pt' => 'pt_PT',
    ];

    /**
     * The translations HTML CodeSniffer ships besides English.
     */
    private const HTMLCS_LANGUAGES = ['fr', 'it', 'ja', 'nl', 'pl'];

    public function __construct(
        private readonly PublicResourceUrlServiceInterface $publicResourceUrlService,
    ) {}

    /**
     * Returns the web path of the axe-core locale for the given language, or an
     * empty string to keep the English messages built into axe-core.
     */
    public function getAxeLocaleUrl(LanguageService $languageService, ServerRequestInterface $request): string
    {
        foreach ($this->getAxeLocaleCandidates($languageService->getLocale()) as $candidate) {
            $localeFile = sprintf(self::AXE_LOCALE_FILE, $candidate);
            if (is_file(GeneralUtility::getFileAbsFileName($localeFile))) {
                return $this->publicResourceUrlService->getWebPath($localeFile, $request);
            }
        }

        return '';
    }

    public function getHtmlCsLanguage(LanguageService $languageService): string
    {
        $languageCode = $languageService->getLocale()?->getLanguageCode() ?? 'en';

        return in_array($languageCode, self::HTMLCS_LANGUAGES, true) ? $languageCode : 'en';
    }

    /**
     * @return list<string>
     */
    private function getAxeLocaleCandidates(?Locale $locale): array
    {
        if ($locale === null || $locale->getLanguageCode() === 'en') {
            return [];
        }

        $languageCode = $locale->getLanguageCode();
        $countryCode = $locale->getCountryCode();
        $candidates = $countryCode !== null && $countryCode !== '' ? [$languageCode . '_' . $countryCode] : [];
        $candidates[] = self::AXE_LOCALE_ALIASES[$languageCode] ?? $languageCode;

        return $candidates;
    }
}
