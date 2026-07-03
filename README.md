# TYPO3 Extension `a11y_by_default` (A11y by default - Accessibility Checker)

Accessibility checker backend module for TYPO3 using axe-core and HTML CodeSniffer.


|                  | URL                                                             |
|------------------|-----------------------------------------------------------------|
| **Repository:**  | https://github.com/web-vision/a11y-by-default                   |
| **Read online:** | https://docs.typo3.org/p/web-vision/a11y-by-default/main/en-us/ |
| **TER:**         | https://extensions.typo3.org/extension/a11y_by_default/         |

## Compatibility

| Branch | Version | TYPO3     | PHP                                          |
|--------|---------|-----------|----------------------------------------------|
| main   | 1.x-dev | v13 + v14 | 8.2, 8.3, 8.4, 8.5                           |

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

## Create a release (maintainers only)

Prerequisites:

* git binary
* ssh key allowed to push new branches to the repository
* GitHub command line tool `gh` installed and configured with user having permission to create pull requests.

**Prepare release locally**

> Set `RELEASE_BRANCH` to branch release should happen, for example: 'main'.
> Set `RELEASE_VERSION` to release version working on, for example: '1.0.0'.

```bash
echo '>> Create release based on configuration' ; \
  RELEASE_BRANCH='main' ; \
  RELEASE_VERSION='1.0.0' ; \
  DEV_VERSION='1.0.1' ; \
  echo ">> Checkout branches" && \
  git checkout main && \
  git fetch --all && \
  git pull --rebase && \
  git checkout ${RELEASE_BRANCH} && \
  git pull --rebase && \
  echo ">> Create release ${RELEASE_VERSION}" && \
  git checkout -b release-${RELEASE_VERSION} && \
  sed -i "s/^COMPOSER_ROOT_VERSION.*/COMPOSER_ROOT_VERSION=\"${RELEASE_VERSION}\"/" Build/Scripts/runTests.sh && \
  sed -i "s/^  RELEASE_VERSION.*/  RELEASE_VERSION='${RELEASE_VERSION}' ; \\\\/" README.md && \
  sed -i "s/^  DEV_VERSION.*/  DEV_VERSION='${DEV_VERSION}' ; \\\\/" README.md && \
  tailor set-version ${RELEASE_VERSION} && \
  composer config "extra"."typo3/cms"."version" "${RELEASE_VERSION}" && \
  echo "${RELEASE_VERSION}" > VERSION && \
  git add . && \
  git commit -m "[RELEASE] ${RELEASE_VERSION}" && \
  git push --set-upstream origin release-${RELEASE_VERSION} && \
  gh pr create --fill --base ${RELEASE_BRANCH} --title "[RELEASE] ${RELEASE_VERSION}" && \
  sleep 10 && \
  gh pr checks --watch --interval 2 && \
  sleep 10 && \
  gh pr merge -rd --admin && \
  git remote prune origin && \
  git tag ${RELEASE_VERSION} && \
  git push origin ${RELEASE_VERSION} && \
  echo ">> Post-release - set dev version: ${DEV_VERSION}-dev" && \
  git checkout -b set-dev-version-${DEV_VERSION} && \
  sed -i "s/^COMPOSER_ROOT_VERSION.*/COMPOSER_ROOT_VERSION=\"${DEV_VERSION}-dev\"/" Build/Scripts/runTests.sh && \
  tailor set-version ${DEV_VERSION} && \
  composer config "extra"."typo3/cms"."version" "${DEV_VERSION}-dev" && \
  echo "${DEV_VERSION}-dev" > VERSION && \
  git add . && \
  git commit -m "[TASK] Set dev version ${DEV_VERSION}" && \
  git push --set-upstream origin set-dev-version-${DEV_VERSION} && \
  gh pr create --fill --base ${RELEASE_BRANCH} --title "[TASK] Set dev version \"${DEV_VERSION}-dev\"" && \
  sleep 10 && \
  gh pr checks --watch --interval 2 && \
  sleep 10 && \
  gh pr merge -rd --admin && \
  git remote prune origin
```


## Credits

Inspired by the pa11y dashboard layout.
Developed by Markus Hofmann (web-vision GmbH).
