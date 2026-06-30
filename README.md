# TYPO3 Extension `a11y_by_default` (A11y by default - Accessibility Checker)

Accessibility checker backend module for TYPO3 using axe-core and HTML CodeSniffer.

## What it does

The goal of this extension is to provide a backend module that shows current accessibility problems of the page selected in the page tree. It helps editors and developers identify and fix accessibility issues directly within the TYPO3 backend.

### Key Features:
- **Client-side Scanning:** Scans run directly in the user's browser using the **TYPO3 View Module technique**. This ensures the rendered page respects the logged-in backend user's session and access rights.
- **Multiple Engines:** Supports **axe-core** (default) and **HTML CodeSniffer** (user-selectable).
- **Issue Classification:** Distinguishes between issues that can be fixed by editors (e.g., content-related) and those that require developer intervention (e.g., template-related).
- **No Data Persistence:** Reports are generated fresh on each call and are not saved to the database.
- **Page Layout Integration:** Shows a hint above the Page Layout module if problems are found on the current page.

## Installation

### Via Composer

```bash
composer require web-vision/a11y-by-default
```

### Manual Installation

1. Download the extension.
2. Upload it to `typo3conf/ext/a11y_by_default`.
3. Activate the extension in the Extension Manager.

## Usage

1. Open the **Accessibility** module in the web section of the TYPO3 backend.
2. Select a page in the page tree.
3. The extension will automatically render the page and perform an accessibility scan.
4. Review the found notices, warnings, and errors.
5. Use the provided links to learn how to fix the identified issues.

## Development

### JavaScript/TypeScript Build

The JavaScript is built from TypeScript. To build the assets, use the provided `runTests.sh` script:

```bash
./Build/Scripts/runTests.sh -s npmInstall
./Build/Scripts/runTests.sh -s buildJs
```

### Testing

The extension includes functional and unit tests for both PHP and JavaScript.

```bash
# Run PHP unit tests
./Build/Scripts/runTests.sh -s unit

# Run PHP functional tests
./Build/Scripts/runTests.sh -s functional

# Run JavaScript linting
./Build/Scripts/runTests.sh -s lintJs
```

## Credits

Inspired by the pa11y dashboard layout.
Developed by Markus Hofmann (web-vision GmbH).
