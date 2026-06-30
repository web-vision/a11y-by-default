# EXT:pa11y

## Goal

The goal of this extension is implementing a backend module showing current problems of the page-tree selected page the
editor is currently working on.

## Requirements

The complete implementation is accessibility clean.

### Technical base

#### TYPO3

The extension must work in TYPO3 13 and 14.

#### Accessibility scanning

The scanning is implemented using **axe-core** (default) and **HTML CodeSniffer** (user-selectable). pa11y is not used
as a runtime dependency — axe-core and HTML CodeSniffer are the scanning engines directly.

The module UI is inspired by the pa11y dashboard layout but must match TYPO3 styleguides and HTML throughout.

The JavaScript implementation follows the actual TYPO3 coding styles for TYPO3 13 and 14. In case of difficulties between
the versions, introduce a Build for both versions.

The JavaScript is built from TypeScript, a build has to be added to the pipeline for releasing the extension.

#### Data persistence

The data must not be saved to the database. Instead, on calling a page in the backend, the report is generated fresh.

#### Fetch the data

The scan runs client-side in the user's browser. The page to be scanned is rendered using the **TYPO3 View Module
technique** — the same mechanism TYPO3 core uses for its backend preview. This ensures the rendered page respects the
currently logged-in backend user's session and access rights, works in every TYPO3 installation without additional server
requirements, and requires no Node.js process on the server.

axe-core (or HTML CodeSniffer) is then executed against the rendered page document directly in the browser.

## Module

The module shows notices, warnings and errors. Every log should contain a link showing how to fix it. We need the possibility
to check if the message is shown due to a fluid/HTML frontend rendering issue or if it's an editor-related problem, the
current user can fix. The info, which person has to fix it, must be given. If the editor has to change, a helpful message,
how to solve must be shown.

### Backend

Do not use Extbase in the Backend. Instead build the controller as a plain controller. Register ist with the attribute.

### What could the editor do

The editor can fix issues related to content from the database. An example of this is the header tree. The extension should be
aware of the current content delivered from the database, which means the table `pages` and `tt_content`.

## PageLayout

The extension must register a header above PageLayout to show a hint that problems were found on this page with a link to the module.

## Testing

The complete module has to be tested with Functional and Unit Tests.

For the JavaScript/TypeScript, functional and unit tests need to be put in place.

## Workflow

### Tasks

Implementation should be done by steps, which concatenate the steps in a build on build order.

### Composer

If php extensions are added or removed, the composer commands have to be added to the commit message. Every composer
related change has to be done by cli to track the used command.

### packages.json

Installing/removing modules to node is always done via cli. Every change of the package.json needs to be done via CLI.
The used command is always part of the commit message.

## Commit

Every commit, which adds changes done via CLI, must have a part with the used commands. Use this template:

`````text
```shell
command 1
command 2
...
```
`````

## Test infrastructure

* Use runTests.sh provided from TYPO3 core
* use TYPO3 Testing Framework
* Run `./Build/Scripts/runTests.sh -s npmInstall` once to install JS dependencies
* Run `./Build/Scripts/runTests.sh -s lintJs` for JavaScript linting
* Run `./Build/Scripts/runTests.sh -s buildJs` for JavaScript building
