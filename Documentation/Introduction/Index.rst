.. include:: ../Includes.rst.txt

.. _introduction:

============
Introduction
============

.. _what-it-does:

What does it do?
================

The goal of this extension is implementing a backend module showing current accessibility problems of the page selected in the page-tree.

The extension allows editors and developers to scan any page directly from the TYPO3 backend. It uses industry-standard engines like **axe-core** and **HTML CodeSniffer** to identify potential issues.

Key features include:

*   **Real-time scanning:** Issues are detected directly in the browser.
*   **Editor/Developer classification:** The module helps identify who is responsible for fixing a specific issue.
*   **Privacy & Security:** Scans are performed client-side, respecting the backend user's permissions and session.
*   **Backend Integration:** Seamlessly integrates into the TYPO3 backend with a dedicated module and Page Layout hints.

.. _screenshots:

Screenshots
===========

.. figure:: ../Images/Bildschirmfoto_20260630_193614.png
   :alt: Backend Module Overview
   :width: 100%

   Overview of the Accessibility Checker backend module.

.. figure:: ../Images/Bildschirmfoto_20260630_193724.png
   :alt: Detailed Issue View
   :width: 100%

   Detailed view of identified accessibility issues.
