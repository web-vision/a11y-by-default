.. include:: ../Includes.rst.txt

.. _developer-corner:

================
Developer Corner
================

This section provides technical details for developers working on or with the extension.

.. _technical-implementation:

Technical Implementation
========================

The extension is built as a plain TYPO3 backend controller (not using Extbase). It leverages the TYPO3 Core's "View Module" mechanism to fetch the rendered frontend HTML of a page.

Issue Classification
--------------------

The extension classifies issues into "Editor" or "Developer" related problems. To achieve this, it checks if the offending HTML element correlates with content delivered from the database (specifically the `pages` and `tt_content` tables). If a match is found, it's typically classified as an editor-fixable issue.

.. _scanning-engines:

Scanning Engines
----------------

The extension uses two main engines for accessibility scanning:

1.  **axe-core** (Default)
2.  **HTML CodeSniffer** (User-selectable)

Both engines run client-side in the browser.

.. _compatibility-handling:

Compatibility Handling
----------------------

The extension is designed to work with both **TYPO3 v13** and **v14**. It handles version differences gracefully, for example by checking for the availability of the contextual record edit route which was introduced in v14.

.. _build-process:

Build Process
=============

The frontend assets (TypeScript/Sass) must be built. The project uses a `runTests.sh` script to manage the build environment.

.. code-block:: bash

   # Install dependencies
   ./Build/Scripts/runTests.sh -s npmInstall

   # Build assets
   ./Build/Scripts/runTests.sh -s buildJs

.. _testing:

Testing
=======

The extension follows TYPO3's testing standards.

PHP Testing
-----------

.. code-block:: bash

   # Unit tests
   ./Build/Scripts/runTests.sh -s unit

   # Functional tests
   ./Build/Scripts/runTests.sh -s functional

JavaScript Testing
------------------

Unit and functional tests for the JavaScript components are located in the `Tests/` directory.

.. code-block:: bash

   # Lint JavaScript
   ./Build/Scripts/runTests.sh -s lintJs
