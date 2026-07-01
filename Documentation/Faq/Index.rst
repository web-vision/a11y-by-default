.. include:: ../Includes.rst.txt

.. _faq:

==========================
Frequently Asked Questions
==========================

.. _faq-scan-speed:

Why does the scan take a few seconds?
=====================================

The extension uses the "View Module" technique to render the page exactly as it would appear to a visitor. This involves a full rendering of the page by TYPO3, which can take some time depending on the complexity of your page and server performance.

.. _faq-protected-pages:

Can I scan protected pages or pages with access restrictions?
==============================================================

Yes. Since the scan runs in your browser using your current backend session, the "View Module" can render any page you have permissions to view in the backend.

.. _faq-multiple-pages:

Can I scan my entire website at once?
=====================================

No. The Accessibility Checker is designed for a page-by-page audit while you are working on a specific page. For full-site audits, we recommend using external tools or CI/CD integrations.

.. _faq-engine-differences:

Why do different engines show different results?
================================================

Different engines (axe-core and HTML CodeSniffer) use different rule sets and algorithms to detect accessibility issues. It is common for them to highlight different aspects or have varying severity levels for the same issue. We recommend reviewing results from both engines for a comprehensive audit.
