.. include:: ../Includes.rst.txt

.. _users-manual:

============
User's Manual
============

This section describes how to use the Accessibility Checker in the TYPO3 backend.

.. _accessing-the-module:

Accessing the Module
====================

Once installed and activated, you will find a new module **Accessibility** in the **Web** section of the backend.

1.  Click on the **Accessibility** module.
2.  Select a page from the page tree on the left.

.. _running-a-scan:

Running a Scan
==============

The scan starts automatically when you select a page. The module uses the "View Module" technique to render the page exactly as it would appear to a visitor, but within your current backend session.

.. _viewing-results:

Viewing Results
===============

The results are displayed in a dashboard-style view:

*   **Errors:** Critical accessibility violations that must be fixed.
*   **Warnings:** Potential issues that should be reviewed.
*   **Notices:** Informational messages about accessibility.

Each issue includes:
-   A description of the problem.
-   The exact HTML element where the issue was found.
-   A classification (Editor vs. Developer).
-   A link to documentation or a guide on how to fix the issue.

Classification Examples
-----------------------

*   **Editor:** Missing alternative text for images (`image-alt`), empty headings (`empty-heading`), or non-descriptive link names (`link-name`).
*   **Developer:** Missing landmarks (`landmark-one-main`), missing or invalid HTML language attributes (`html-has-lang`), or insufficient color contrast in the design (`color-contrast`).

.. _page-layout-hint:

Page Layout Hint
================

When working in the **Page** module, the extension may display a header hint if accessibility issues are detected on the current page. This allows you to jump directly to the Accessibility module to review the problems.
